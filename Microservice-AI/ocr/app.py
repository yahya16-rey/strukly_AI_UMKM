from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from paddleocr import PaddleOCR
from datetime import datetime
from rapidfuzz import fuzz
import cv2
import re
import numpy as np
import requests

app = FastAPI(title="OCR & Extraction Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inisialisasi PaddleOCR
paddle_engine = PaddleOCR(
    lang='id',
    show_log=False,
    use_angle_cls=False,
    enable_mkldnn=True,
    cpu_threads=2,
    ocr_version="PP-OCRv4",
    det_limit_side_len=640
)

SPACE_B_URL = "https://struklyai-clasify.hf.space/classify/"
SPACE_C_URL = "https://struklyai-clasify2.hf.space/classify/"

# ENGINE EKSTRAKSI (RULE-BASED + REGEX)

def clean(text):
    return text.replace("  ", " ")

def clean_item_name(text):
    text = re.sub(r'\d+[A-Z]?$', '', text).strip()
    text = text.replace("'", "")
    return text

MONTH_MAP = {
    "jan": 1, "januari": 1,
    "feb": 2, "februari": 2,
    "mar": 3, "maret": 3,
    "apr": 4, "april": 4, "ap": 4,
    "mei": 5, "may": 5,
    "jun": 6, "juni": 6,
    "jul": 7, "juli": 7,
    "aug": 8, "agu": 8, "agustus": 8,
    "sep": 9, "september": 9,
    "oct": 10, "okt": 10, "oktober": 10,
    "nov": 11, "november": 11,
    "dec": 12, "des": 12, "desember": 12,
}

def extract_transaction_date(raw_text: str):
    raw_text = re.sub(r"\s+", " ", raw_text).strip()
    current_year = datetime.now().year

    def valid_year(y: int) -> bool:
        return 2000 <= y <= current_year + 1

    def make_date(d: int, m: int, y: int):
        if y < 100:
            y += 2000
        if valid_year(y) and 1 <= m <= 12 and 1 <= d <= 31:
            try:
                return datetime(y, m, d)
            except ValueError:
                pass
        return None

    # yyyy-mm-ddTHH:MM[:SS]
    hit = re.search(r'(\d{4})-(\d{2})-(\d{2})T', raw_text)
    if hit:
        dt = make_date(int(hit.group(3)), int(hit.group(2)), int(hit.group(1)))
        if dt: return dt.strftime("%d-%m-%Y")

    # yyyy[sep]mm[sep]dd
    hit = re.search(r'(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})', raw_text)
    if hit:
        dt = make_date(int(hit.group(3)), int(hit.group(2)), int(hit.group(1)))
        if dt: return dt.strftime("%d-%m-%Y")

    # HH[:.]MM[:SS] <space> dd[sep]mm[sep]yyyy/yy
    hit = re.search(
        r'\d{1,2}[:.]\d{2}(?::\d{2})?\s+(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})',
        raw_text
    )
    if hit:
        dt = make_date(int(hit.group(1)), int(hit.group(2)), int(hit.group(3)))
        if dt: return dt.strftime("%d-%m-%Y")

    # dd[sep]Month[sep]yyyy/yy
    for h in re.finditer(r'(\d{1,2})[/\-. ]([a-zA-Z]+)[/\-. ](\d{2,4})', raw_text, re.IGNORECASE):
        candidate = h.group(2).lower()
        if len(candidate) > 9:
            continue
        month_num = MONTH_MAP.get(candidate)
        if month_num:
            dt = make_date(int(h.group(1)), month_num, int(h.group(3)))
            if dt: return dt.strftime("%d-%m-%Y")

    # ddMonyyyy atau ddMonyy
    for yr_pat in (r'(\d{4})', r'(\d{2})'):
        hit = re.search(
            rf'(\d{{1,2}})([a-zA-Z]{{2,}}){yr_pat}',
            raw_text, re.IGNORECASE
        )
        if hit:
            month_num = MONTH_MAP.get(hit.group(2).lower())
            if month_num:
                dt = make_date(int(hit.group(1)), month_num, int(hit.group(3)))
                if dt: return dt.strftime("%d-%m-%Y")

    # dd[sep]mm[sep]yyyy
    for sep_pat in (r'[/\-.]', r'\s'):
        hit = re.search(rf'(\d{{1,2}}){sep_pat}(\d{{1,2}}){sep_pat}(\d{{4}})', raw_text)
        if hit:
            dt = make_date(int(hit.group(1)), int(hit.group(2)), int(hit.group(3)))
            if dt: return dt.strftime("%d-%m-%Y")

    # yyyymmdd
    hit = re.search(r'(?<!\d)(20\d{2})([01]\d)([0-3]\d)(?!\d)', raw_text)
    if hit:
        dt = make_date(int(hit.group(3)), int(hit.group(2)), int(hit.group(1)))
        if dt: return dt.strftime("%d-%m-%Y")

    # ddmmyyyy
    hit = re.search(r'(?<!\d)([0-3]\d)([01]\d)(20\d{2})(?!\d)', raw_text)
    if hit:
        dt = make_date(int(hit.group(1)), int(hit.group(2)), int(hit.group(3)))
        if dt: return dt.strftime("%d-%m-%Y")

    # dd[sep]mm[sep]yy
    for sep in ('-', '/', '.', ' '):
        esc = re.escape(sep)
        hit = re.search(
            rf'(\d{{1,2}}){esc}(\d{{1,2}}){esc}(\d{{2}})(?!\d{{2}}{esc})',
            raw_text
        )
        if hit:
            dt = make_date(int(hit.group(1)), int(hit.group(2)), int(hit.group(3)))
            if dt: return dt.strftime("%d-%m-%Y")

    # ddmmyy
    hit = re.search(r'(?<!\d)([0-3]\d)([01]\d)(\d{2})(?!\d)', raw_text)
    if hit:
        dt = make_date(int(hit.group(1)), int(hit.group(2)), int(hit.group(3)))
        if dt: return dt.strftime("%d-%m-%Y")

    return None

def extract_number(line):
    line = line.upper().replace("RP", "")
    match = re.search(r'\d{1,3}(?:[.,]\d{3})+', line)
    return match.group() if match else None

def has_money(line):
    return bool(extract_number(line))

def is_noise(line):
    upper = line.upper().strip()

    noise_keywords = [
        "TOTAL", "SUBTOTAL", "CASH", "KEMBALI", "CHANGE", "BAYAR", "PAID",
        "ITEM", "QTY", "TERIMA", "KASIH", "THANK", "PELANGGAN",
        "STAFF", "KASSA", "NPWP", "TRANS", "DELIVERY",
        "DISCOUNT", "DISC", "ROUNDED", "DEBIT", "CREDIT",
        "PPN", "DPP", "TUNAI", "HEMAT",
        "UNBOXING", "COMPLAIN", "VIDEO",
        "WWW.", "HTTP",
        "CASHIER", "MOHON"
    ]

    address_keywords = [
        "JL", "JLN", "JALAN", "RAYA", "KEL", "KEC", "KAB",
        "KOTA", "RT", "RW","BARAT", "TIMUR",
        "SELATAN", "UTARA", "TENGAH"
    ]

    promo_keywords = [
        "PT ", "/PT", "CV ", "PROMO", "VOUCHER", "MEMBER"
    ]

    if any(k in upper for k in noise_keywords):
        return True

    if any(k in upper for k in address_keywords):
        return True

    if any(k in upper for k in promo_keywords):
        return True

    if re.fullmatch(r'[\d.,:=-]+', upper):
        return True

    if re.search(r'\{?\d+\}?X\d+', upper.replace(" ", "")):
        return True

    if re.search(r'\d+\s*X\s*@?', upper):
        return True

    if re.search(r'\bRP\b', upper):
        return True

    return False

def is_product_like(line):
    return (
        bool(re.search(r'\d+\s*(PCS|BKS|BTL|@)', line.upper())) or
        bool(re.search(r'\d{1,3}[.,]\d{3}', line))
    )

def is_noise_merc(line):
    upper = line.upper().strip()

    noise_keywords = [
        "TOTAL", "CASH", "KEMBALI", "CHANGE", "BAYAR", "PAID",
        "ITEM", "QTY", "TERIMA", "KASIH", "THANK",
        "RUKO", "PELANGGAN", "STAFF", "KASSA",
        "NPWP", "HP", "TRANS", "BISA DELIVERY"
    ]

    if any(k in upper for k in noise_keywords):
        return True

    if re.fullmatch(r'[\d.,:()\-]+', upper):
        return True

    if re.fullmatch(r'\d+\w*@', upper.replace(" ", "")):
        return True

    if "." in line and len(line.split()) == 1:
        return True

    if re.search(r'^[A-Z0-9]{5,}$', upper) and any(c.isdigit() for c in upper):
        return True

    return False


def detect_merchant(lines):
    for line in lines[:4]:
        line = line.strip("= ").strip()

        if not line:
            continue

        if is_noise_merc(line):
            continue

        # skip line yang mirip product / harga
        if is_product_like(line):
            continue

        # skip line dominan angka
        if any(c.isdigit() for c in line) and len(line) < 8:
            continue

        return line

    return "Tidak Terdeteksi"


def normalize(line):
    return re.sub(r"\s+", " ", line).strip()


def is_noise_items(line):

    NOISE_KEYWORDS = {
    "TOTAL", "SUBTOTAL", "CASH", "KEMBALI", "CHANGE", "BAYAR", "PAID",
    "ITEM", "QTY", "TERIMA", "KASIH", "THANK", "PELANGGAN",
    "STAFF", "KASSA", "NPWP", "TRANS", "DELIVERY", "TT4L",
    "DISCOUNT", "DISC", "ROUNDED", "DEBIT", "CREDIT", "BTKP",
    "PPN", "DPP", "TUNAI", "HEMAT", "TIMUR", "BARAT", "BKP",
    "UNBOXING", "COMPLAIN", "VIDEO", "UTARA", "SELATAN",
    "WWW", "HTTP", "CASHIER", "MOHON", "JL", "J1", "JALAN",
    "RAYA", "KEL", "KEC", "KAB", "KOTA", "RT", "RW",
    "PT", "/PT", "CV", "PROMO", "VOUCHER", "MEMBER",
    "TAGIHAN", "TEMPAT", "WAKTU", "CHECK", "PAYMENT",
    "CLOSED", "SARAN", "CUSTOMER", "SERVICE",
    "POTONGAN", "PEMBAYARAN", "JUMLAH BAYAR"
    }

    line = normalize(line)
    upper = line.upper()

    if not line:
        return True

    if re.fullmatch(r'[\d.,:;=\-+@{}xX()/ ]+', line):
        return True

    if re.search(r'\bRP\b', upper):
        return True

    if any(k in upper for k in NOISE_KEYWORDS):
        return True

    if "WWW" in upper or "HTTP" in upper:
        return True

    if re.search(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', line):
        return True

    if re.search(r'\d{1,2}:\d{2}', line):
        return True

    return False


def looks_like_price(line):
    line = normalize(line).upper()

    if re.search(r'RP\s?[\d.,]+', line):
        return True

    if re.fullmatch(r'[\d.,]{3,}', line):
        return True

    return False


def looks_like_qty_price(line):

    line = normalize(line).upper().replace(" ", "")

    patterns = [
        r'^\{?\d+\}?X',
        r'^\d+[.,]?\d*X@',
        r'^\d+(PCS|BTL|BKS)@?',
    ]

    return any(re.search(p, line) for p in patterns)

def is_item_candidate(line):
    line = normalize(line)

    if is_noise_items(line):
        return False

    letters = sum(c.isalpha() for c in line)
    if letters < 3:
        return False\

    if re.fullmatch(r'[A-Z0-9\-]{8,}', line.upper()):
        return False

    return True

def looks_like_phone(line):
    digits = re.sub(r'\D', '', line)
    lowered = line.lower()

    return (
        len(digits) >= 9 and
        (
            digits.startswith('08') or
            digits.startswith('62') or
            'telp' in lowered or
            'phone' in lowered or
            'hp' in lowered
        )
    )


def clean_item(line):
    line = normalize(line)

    line = re.sub(r'^\{?\d+\}?[Xx]\s*@?[\d.,]*', '', line)
    line = re.sub(r'^\d+(PCS|BTL|BKS)@?', '', line, flags=re.I)

    return line.strip(" -=@")


def extract_items(lines):
    lines = [normalize(x) for x in lines if normalize(x) and not looks_like_phone(normalize(x))]
    lines = lines[3:]
    result = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # qty+item same line
        if looks_like_qty_price(line):
            item = clean_item(line)
            if is_item_candidate(item):
                result.append(item)
            i += 1
            continue

        # item followed by price/qty
        if is_item_candidate(line) and not looks_like_phone(line):
            next_lines = lines[i+1:i+4]

            if any(looks_like_price(x) or looks_like_qty_price(x) for x in next_lines):
                result.append(line)
                i += 1
                continue

        # qty line followed by item
        if looks_like_qty_price(line) or re.match(r'^\d+[Xx]', line):
            next_lines = lines[i+1:i+3]
            for nxt in next_lines:
                if is_item_candidate(nxt):
                    result.append(nxt)
                    break

        i += 1

    seen = set()
    final = []
    for x in result:
        key = x.upper()
        if key not in seen:
            seen.add(key)
            final.append(x)

    final = [item.lstrip('0123456789 ') for item in final]
    return final


def extract_number(text):
    nums = re.findall(r'-?\d[\d.,]*', text)
    values = []
    for n in nums:
        digits = re.sub(r'\D', '', n)
        if len(digits) > 7:
            continue

        clean = re.sub(r'[.,]', '', n)
        clean = clean.replace("-", "")

        if clean.isdigit():
            value = int(clean)
            if 100 <= value <= 50000000:
                values.append(value)

    if not values:
        return None

    return max(values)

def detect_total(lines):
    rules = [
        (r"^TOTAL[: ]*$", 100),
        (r"\bTOTAL\s*BAYAR\b", 95),
        (r"\bGRAND\s*TOTAL\b", 95),
        (r"\bPEMBAYARAN\b", 90),
        (r"\bSUB\s*TOTAL\b", 50),
    ]

    ignore_keywords = [
        "HEMAT", "DISCOUNT", "PPN", "DPP",
        "BKP", "POT", "BTKP", "TELP",
        "CUSTOMER", "NPWP",
    ]

    stop_keywords = [
        "KEMBALI", "CHANGE",
    ]

    candidates = []

    for i, line in enumerate(lines):
        up = line.upper().strip()
        if any(x in up for x in ignore_keywords):
            continue

        for pattern, score in rules:
            if re.search(pattern, up):
                for j in range(i, min(i + 5, len(lines))):
                    nxt = lines[j].upper().strip()
                    if any(x in nxt for x in stop_keywords):
                        break
                    num = extract_number(lines[j])
                    if num:
                        distance_penalty = (j - i) * 5
                        final_score = score - distance_penalty
                        candidates.append(
                            (final_score, num)
                        )

    if not candidates:
        return "0"

    candidates.sort(reverse=True)
    return str(candidates[0][1])

def extract_receipt(text):
    text = clean(text)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    return {
        "merchant": detect_merchant(lines),
        "items": extract_items(lines),
        "total": detect_total(lines)
    }


# API ENDPOINTS

@app.get("/")
def home():
    return {"status": "Optima Team - OCR API Aktif :D !"}

@app.post("/scan-ocr/")
async def proses_gambar_paddle(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        result = paddle_engine.ocr(img)
        
        teks_terbaca = []
        if result and result[0]:
            for baris in result[0]:
                teks_terbaca.append(baris[1][0])
                
        ocr_mentah = "\n".join(teks_terbaca)
        
        date = extract_transaction_date(ocr_mentah)
        hasil_ekstraksi = extract_receipt(ocr_mentah)
        
        merchant = hasil_ekstraksi["merchant"]
        items_list = hasil_ekstraksi["items"]
        
        total_str = re.sub(r'[^\d]', '', hasil_ekstraksi["total"])
        total = int(total_str) if total_str else 0
        
        class_id = None
        class_name = "Tidak Ditemukan"
        confidence = 0.0

        if items_list:
            target_spaces = [SPACE_B_URL, SPACE_C_URL]
            berhasil_klasifikasi = False

            for url in target_spaces:
                try:
                    response = requests.post(url, json={"items": items_list}, timeout=15)
                    
                    if response.status_code == 200:
                        data = response.json()
                        class_id = data.get("class_id") 
                        class_name = data.get("category_name")
                        confidence = data.get("confidence")
                        
                        berhasil_klasifikasi = True
                        break  # break loop jika respons 200

                    else:
                        print(f"Gagal dari {url}, status: {response.status_code}. Beralih ke Next Space")
                
                except requests.exceptions.RequestException as e:
                    print(f"Koneksi ke {url} gagal ({e}). Beralih ke Next Space")

            if not berhasil_klasifikasi:
                print("Semua Space AI gagal dihubungi.")
                class_name = "Error AI (Semua Server Down/Limit)"
        
        return {
            "sukses": True, 
            "ocr_mentah": ocr_mentah, 
            "date": date, 
            "items": items_list,
            "merchant": merchant, 
            "total": total, 
            "classes": class_id,
            "category_name": class_name,
            "confidence": confidence
        }
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"sukses": False, "pesan": str(e)})

@app.get("/ping")
async def antisleep():
    return {"success": True, "message": "Server OCR aktif"}