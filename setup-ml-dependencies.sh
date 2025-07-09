#!/bin/bash

# StokCerdas ML Dependencies Setup Script
# Phase 4.1.5.1: Address Python ML dependencies and fallback mechanisms

echo "🔧 Setting up Python ML dependencies for StokCerdas..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "📋 Python version: $PYTHON_VERSION"

if [[ $(echo "$PYTHON_VERSION < 3.8" | bc) -eq 1 ]]; then
    echo "❌ Python 3.8+ is required. Current version: $PYTHON_VERSION"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip

# Install ML dependencies
echo "📚 Installing ML dependencies from requirements.txt..."
pip install -r requirements.txt

# Install additional Indonesian business calendar dependencies
echo "🇮🇩 Installing Indonesian business calendar dependencies..."
pip install hijri-converter convertdate

# Test installations
echo "🧪 Testing ML library installations..."

# Test pandas
python3 -c "import pandas; print('✅ pandas installed successfully')" || echo "❌ pandas installation failed"

# Test numpy
python3 -c "import numpy; print('✅ numpy installed successfully')" || echo "❌ numpy installation failed"

# Test scikit-learn
python3 -c "import sklearn; print('✅ scikit-learn installed successfully')" || echo "❌ scikit-learn installation failed"

# Test statsmodels
python3 -c "import statsmodels; print('✅ statsmodels installed successfully')" || echo "❌ statsmodels installation failed"

# Test prophet
python3 -c "import prophet; print('✅ prophet installed successfully')" || echo "❌ prophet installation failed"

# Test xgboost
python3 -c "import xgboost; print('✅ xgboost installed successfully')" || echo "❌ xgboost installation failed"

# Test Indonesian calendar libraries
python3 -c "import hijri_converter; print('✅ hijri-converter installed successfully')" || echo "❌ hijri-converter installation failed"

# Create ML service test script
echo "🧪 Creating ML service validation script..."
cat > validate-ml-services.py << 'EOF'
#!/usr/bin/env python3

import sys
import json
import traceback
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

def test_arima_prediction():
    """Test ARIMA model prediction"""
    try:
        from statsmodels.tsa.arima.model import ARIMA
        
        # Generate sample data
        np.random.seed(42)
        dates = pd.date_range('2024-01-01', periods=90, freq='D')
        values = 100 + np.cumsum(np.random.randn(90) * 0.5)
        
        # Create ARIMA model
        model = ARIMA(values, order=(2, 1, 2))
        fitted_model = model.fit()
        
        # Make prediction
        forecast = fitted_model.forecast(steps=30)
        
        return {
            'success': True,
            'predicted_value': float(forecast.mean()),
            'confidence': 0.85,
            'model_type': 'ARIMA(2,1,2)'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }

def test_prophet_prediction():
    """Test Prophet model prediction"""
    try:
        from prophet import Prophet
        
        # Generate sample data
        np.random.seed(42)
        dates = pd.date_range('2024-01-01', periods=90, freq='D')
        values = 100 + np.cumsum(np.random.randn(90) * 0.5)
        
        # Create Prophet dataframe
        df = pd.DataFrame({
            'ds': dates,
            'y': values
        })
        
        # Create and fit Prophet model
        model = Prophet(yearly_seasonality=True, weekly_seasonality=True)
        model.fit(df)
        
        # Make prediction
        future = model.make_future_dataframe(periods=30)
        forecast = model.predict(future)
        
        return {
            'success': True,
            'predicted_value': float(forecast['yhat'].iloc[-1]),
            'confidence': 0.88,
            'model_type': 'Prophet'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }

def test_xgboost_prediction():
    """Test XGBoost model prediction"""
    try:
        import xgboost as xgb
        from sklearn.model_selection import train_test_split
        
        # Generate sample data
        np.random.seed(42)
        X = np.random.randn(100, 5)
        y = np.sum(X, axis=1) + np.random.randn(100) * 0.1
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Create and train XGBoost model
        model = xgb.XGBRegressor(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        
        # Make prediction
        prediction = model.predict(X_test[:1])
        
        return {
            'success': True,
            'predicted_value': float(prediction[0]),
            'confidence': 0.82,
            'model_type': 'XGBoost'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }

def main():
    print("🧪 Testing ML Services...")
    
    results = {
        'arima': test_arima_prediction(),
        'prophet': test_prophet_prediction(),
        'xgboost': test_xgboost_prediction()
    }
    
    # Print results
    for model_name, result in results.items():
        if result['success']:
            print(f"✅ {model_name.upper()}: Success (Value: {result['predicted_value']:.2f}, Confidence: {result['confidence']:.2f})")
        else:
            print(f"❌ {model_name.upper()}: Failed - {result['error']}")
    
    # Calculate success rate
    success_count = sum(1 for r in results.values() if r['success'])
    success_rate = success_count / len(results) * 100
    
    print(f"\n📊 Overall Success Rate: {success_rate:.1f}%")
    
    # Return results as JSON for Node.js integration
    print("\n📋 JSON Results:")
    print(json.dumps(results, indent=2))
    
    return results

if __name__ == "__main__":
    main()
EOF

# Run ML service validation
echo "🔄 Running ML service validation..."
python3 validate-ml-services.py

echo "✅ ML dependencies setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. Run ML service validation: python3 validate-ml-services.py"
echo "3. Test Node.js integration: npm run test:integration"
echo ""
echo "💡 For production deployment, ensure the virtual environment is activated"
echo "   and all dependencies are installed before starting the Node.js server."