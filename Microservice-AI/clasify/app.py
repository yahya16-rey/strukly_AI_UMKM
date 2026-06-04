import os
import pickle
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

# Optimasi RAM
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

app = FastAPI(title="AI Classification Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ItemRequest(BaseModel):
    items: list[str]

class CustomDense(layers.Layer):

    def __init__(self, units, activation=None, dropout_rate=0.0, **kwargs):
        super(CustomDense, self).__init__(**kwargs)

        self.units = units
        self.activation = tf.keras.activations.get(activation)
        self.dropout_rate = dropout_rate
        self.dropout = layers.Dropout(dropout_rate)

    def build(self, input_shape):

        self.w = self.add_weight(
            shape=(input_shape[-1], self.units),
            initializer='he_normal',
            trainable=True,
            name='kernel'
        )

        self.b = self.add_weight(
            shape=(self.units,),
            initializer='zeros',
            trainable=True,
            name='bias'
        )

    def call(self, inputs, training=False):

        x = tf.matmul(inputs, self.w) + self.b

        if self.activation is not None:
            x = self.activation(x)

        x = self.dropout(x, training=training)

        return x

    def get_config(self):

        config = super().get_config()

        config.update({
            "units": self.units,
            "activation": tf.keras.activations.serialize(self.activation),
            "dropout_rate": self.dropout_rate
        })

        return config

model = None
encoder = None

def get_model():
    global model, encoder
    if model is None:
        model = tf.keras.models.load_model('model_strukly.keras', custom_objects={'CustomDense': CustomDense})
        with open('penerjemah_kategori.pkl', 'rb') as file:
            encoder = pickle.load(file)
    return model, encoder

@app.post("/classify/")
def classify_items(request: ItemRequest):
    try:
        items_list = request.items
        
        # Jika array kosong
        if not items_list:
             return {
                 "success": True, 
                 "class_id": None, 
                 "category_name": "Tidak Terdeteksi",
                 "confidence": 0.0
             }
             
        m, e = get_model()
        
        # Dictionary untuk melacak hasil
        category_counts = {}
        max_confidences = {}
        
        # Prediksi satu per satu
        for item in items_list:
            if not item.strip():
                continue
                
            input_data = tf.constant([item], dtype=tf.string)
            hasil_prediksi = m.predict(input_data, verbose=0)
            
            cat_id = int(np.argmax(hasil_prediksi[0]))
            conf = float(np.max(hasil_prediksi[0]))
            
            # Hitung frekuensi kategori
            if cat_id in category_counts:
                category_counts[cat_id] += 1
            else:
                category_counts[cat_id] = 1
                
            # Simpan confidence tertinggi untuk kategori
            if cat_id not in max_confidences or conf > max_confidences[cat_id]:
                max_confidences[cat_id] = conf
                
        # Jika semua item string kosong
        if not category_counts:
             return {
                 "success": True, 
                 "class_id": None, 
                 "category_name": "Tidak Terdeteksi",
                 "confidence": 0.0
             }

        # Candidate Kategori terbanyak
        best_cat_id = max(category_counts, key=category_counts.get)
        best_cat_name = e.inverse_transform([best_cat_id])[0]
        
        # Ambil confidence tertinggi dari hasil candidate
        best_confidence = max_confidences[best_cat_id]
        
        return {
            "success": True, 
            "class_id": best_cat_id,
            "category_name": best_cat_name,
            "confidence": round(best_confidence, 2)
        }
        
    except Exception as err:
        import traceback
        print(f"Error AI Klasifikasi: {traceback.format_exc()}")
        return {
            "success": False, "error": str(err), "class_id": None, "category_name": None,
            "confidence": 0.0
        }

@app.get("/ping")
async def antisleep():
    return {"success": True, "message": "Server Classify aktif"}