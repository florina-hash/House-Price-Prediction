# -*- coding: utf-8 -*-
import pandas as pd
from flask import Flask, jsonify, request, render_template
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

app = Flask(__name__, template_folder='templates', static_folder='static')

# Initial dataset
data_points = [
    {"sqft": 1000, "price": 1500000},
    {"sqft": 1500, "price": 2250000},
    {"sqft": 2000, "price": 3000000},
    {"sqft": 2500, "price": 3750000},
    {"sqft": 3000, "price": 4500000},
    {"sqft": 3500, "price": 5250000},
    {"sqft": 4000, "price": 6000000},
    {"sqft": 4500, "price": 6750000},
    {"sqft": 5000, "price": 7500000},
    {"sqft": 5500, "price": 8250000},
    {"sqft": 6000, "price": 9000000},
    {"sqft": 6500, "price": 9750000},
    {"sqft": 7000, "price": 10500000},
    {"sqft": 7500, "price": 11250000},
    {"sqft": 8000, "price": 12000000}
]

# Model state variables
model = None
r2 = 0.0
mse = 0.0

def retrain_model():
    global model, r2, mse
    df = pd.DataFrame(data_points)
    a = df[['sqft']]
    p = df[['price']]
    
    model = LinearRegression()
    
    if len(df) > 2:
        # Adjust test size dynamically for small datasets
        test_size = 0.2 if len(df) >= 5 else 0.5
        a_train, a_test, p_train, p_test = train_test_split(a, p, test_size=test_size, random_state=42)
        model.fit(a_train, p_train)
        price_pred = model.predict(a_test)
        mse = float(mean_squared_error(p_test, price_pred))
        r2 = float(r2_score(p_test, price_pred))
    else:
        # Fallback when there aren't enough points to split
        model.fit(a, p)
        mse = 0.0
        r2 = 1.0

# Train initially
retrain_model()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/model', methods=['GET'])
def get_model_details():
    df = pd.DataFrame(data_points)
    min_sqft = float(df['sqft'].min())
    max_sqft = float(df['sqft'].max())
    
    # Predict endpoints for the regression line
    pred_min = float(model.predict([[min_sqft]])[0][0])
    pred_max = float(model.predict([[max_sqft]])[0][0])
    
    # Also calculate coefficients for details
    slope = float(model.coef_[0][0])
    intercept = float(model.intercept_[0])
    
    return jsonify({
        "dataset": data_points,
        "r2": r2,
        "mse": mse,
        "slope": slope,
        "intercept": intercept,
        "line": [
            {"sqft": min_sqft, "price": pred_min},
            {"sqft": max_sqft, "price": pred_max}
        ]
    })

@app.route('/api/predict', methods=['POST'])
def predict():
    req_data = request.get_json()
    if not req_data or 'sqft' not in req_data:
        return jsonify({"error": "Missing 'sqft' in request body"}), 400
    
    try:
        sqft = float(req_data['sqft'])
        prediction = float(model.predict([[sqft]])[0][0])
        return jsonify({
            "sqft": sqft,
            "predicted_price": prediction
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/dataset', methods=['POST'])
def add_data_point():
    req_data = request.get_json()
    if not req_data or 'sqft' not in req_data or 'price' not in req_data:
        return jsonify({"error": "Missing 'sqft' or 'price' in request body"}), 400
    
    try:
        sqft = float(req_data['sqft'])
        price = float(req_data['price'])
        
        # Add to global list
        data_points.append({"sqft": sqft, "price": price})
        
        # Retrain model with new point
        retrain_model()
        
        return jsonify({
            "message": "Data point added and model retrained successfully",
            "point": {"sqft": sqft, "price": price}
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/dataset/delete', methods=['POST'])
def delete_data_point():
    req_data = request.get_json()
    if not req_data or 'sqft' not in req_data or 'price' not in req_data:
        return jsonify({"error": "Missing 'sqft' or 'price' in request body"}), 400
    
    try:
        sqft = float(req_data['sqft'])
        price = float(req_data['price'])
        
        global data_points
        match_found = False
        for i, pt in enumerate(data_points):
            if pt['sqft'] == sqft and pt['price'] == price:
                data_points.pop(i)
                match_found = True
                break
                
        if not match_found:
            return jsonify({"error": "Data point not found"}), 404
            
        retrain_model()
        
        return jsonify({
            "message": "Data point deleted and model retrained successfully",
            "deleted_point": {"sqft": sqft, "price": price}
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    import os
    port=int(os.environ.get("PORT",5000))
    print(f"Starting AeroPredict Flask server at http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port,debug=true)