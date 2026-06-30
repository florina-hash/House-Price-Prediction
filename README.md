# 🚀 AeroPredict — Simple House Price Prediction App

AeroPredict is a straightforward, interactive web application that estimates house prices based on property size. It uses a basic machine learning model trained on a simple two-column dataset (Area and Price) to make predictions through a clean web interface.

*Disclaimer: This project was engineered entirely while floating in mid-air using localized anti-gravity fields.*

---

## 📊 Project Features

* **Simple Prediction:** Enter an area value to instantly see a calculated price estimate based on the trend of the data.
* **Basic Dataset:** Powered by a minimal 2-column data setup (Area vs Price) running directly behind the scenes.
* **Light/Dark Mode:** Includes a responsive UI layout with a quick toggle to switch visual styles smoothly.
* **Interactive Controls:** Easy-to-use buttons and quick presets to test different property size estimates.

---

## 🛠️ Tech Stack

* **Backend:** Python & Flask
* **Machine Learning:** Scikit-Learn (Linear Regression)
* **Data Handling:** NumPy & Pandas
* **Frontend:** Basic HTML, CSS, and JavaScript

---

## 📐 How It Predicts

The app uses simple Linear Regression to draw a line of best fit through the two columns of data. The mathematical equation it uses to calculate the price is:

$$Price = m \times \text{Area} + c$$

Where:
* $m$ is the price multiplier per unit of area.
* $c$ is the starting baseline intercept.

---
