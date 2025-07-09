#!/usr/bin/env python3
"""
StokCerdas AI - Real Prophet Implementation
Advanced seasonal forecasting with Indonesian business context
"""

import sys
import json
import pandas as pd
import numpy as np
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics
import warnings
warnings.filterwarnings('ignore')


class RealProphetService:
    """
    Real Prophet implementation for seasonal time series forecasting
    Optimized for Indonesian business patterns and holidays
    """
    
    def __init__(self):
        self.model = None
        self.fitted_model = None
        self.cv_results = None
        
    def prepare_data(self, data_points, dates=None):
        """
        Prepare time series data for Prophet modeling
        Prophet requires 'ds' (datestamp) and 'y' (value) columns
        """
        try:
            if dates:
                # Create Prophet dataframe with dates
                df = pd.DataFrame({
                    'ds': pd.to_datetime(dates),
                    'y': data_points
                })
            else:
                # Use sequential dates starting from today
                start_date = pd.Timestamp.now() - pd.Timedelta(days=len(data_points)-1)
                date_range = pd.date_range(start=start_date, periods=len(data_points), freq='D')
                df = pd.DataFrame({
                    'ds': date_range,
                    'y': data_points
                })
            
            # Handle missing values
            df['y'] = df['y'].fillna(method='ffill').fillna(method='bfill')
            
            # Ensure minimum data points
            if len(df) < 10:
                raise ValueError("Insufficient data points for Prophet (minimum 10 required)")
                
            # Ensure non-negative values for inventory context
            df['y'] = np.maximum(df['y'], 0)
            
            return df
            
        except Exception as e:
            raise Exception(f"Data preparation failed: {str(e)}")
    
    def add_indonesian_holidays(self):
        """
        Add Indonesian national holidays and business calendar
        """
        try:
            # Indonesian national holidays (2024-2025)
            holidays = pd.DataFrame({
                'holiday': 'indonesian_holiday',
                'ds': pd.to_datetime([
                    # 2024
                    '2024-01-01',  # New Year
                    '2024-02-08',  # Chinese New Year
                    '2024-02-09',  # Chinese New Year Holiday
                    '2024-02-10',  # Isra Miraj
                    '2024-03-11',  # Nyepi (Balinese New Year)
                    '2024-03-29',  # Good Friday
                    '2024-04-10',  # Eid al-Fitr
                    '2024-04-11',  # Eid al-Fitr Holiday
                    '2024-05-01',  # Labor Day
                    '2024-05-09',  # Ascension Day
                    '2024-05-23',  # Vesak Day
                    '2024-06-01',  # Pancasila Day
                    '2024-06-17',  # Eid al-Adha
                    '2024-08-17',  # Independence Day
                    '2024-09-16',  # Islamic New Year
                    '2024-11-25',  # Prophet Muhammad's Birthday
                    '2024-12-25',  # Christmas
                    
                    # 2025
                    '2025-01-01',  # New Year
                    '2025-01-29',  # Chinese New Year
                    '2025-01-30',  # Chinese New Year Holiday
                    '2025-02-14',  # Isra Miraj
                    '2025-03-14',  # Nyepi
                    '2025-03-31',  # Eid al-Fitr
                    '2025-04-01',  # Eid al-Fitr Holiday
                    '2025-04-18',  # Good Friday
                    '2025-05-01',  # Labor Day
                    '2025-05-12',  # Vesak Day
                    '2025-05-29',  # Ascension Day
                    '2025-06-01',  # Pancasila Day
                    '2025-06-07',  # Eid al-Adha
                    '2025-08-17',  # Independence Day
                    '2025-09-05',  # Islamic New Year
                    '2025-11-14',  # Prophet Muhammad's Birthday
                    '2025-12-25',  # Christmas
                ]),
                'lower_window': 0,
                'upper_window': 1,
            })
            
            return holidays
            
        except Exception as e:
            # Return empty holidays if failed
            return pd.DataFrame(columns=['holiday', 'ds', 'lower_window', 'upper_window'])
    
    def create_prophet_model(self, seasonality_config=None):
        """
        Create Prophet model with Indonesian business optimization
        """
        try:
            # Default seasonality configuration for Indonesian SMBs
            if seasonality_config is None:
                seasonality_config = {
                    'yearly_seasonality': True,
                    'weekly_seasonality': True,
                    'daily_seasonality': False,  # Most SMBs don't have hourly data
                    'seasonality_mode': 'multiplicative',  # Better for business data
                    'seasonality_prior_scale': 10.0,  # Allow flexibility
                    'holidays_prior_scale': 10.0,  # Indonesian holidays are important
                    'changepoint_prior_scale': 0.05,  # Conservative change detection
                    'interval_width': 0.80,  # 80% confidence intervals
                    'growth': 'linear'  # Linear growth assumption
                }
            
            # Create Prophet model
            model = Prophet(
                yearly_seasonality=seasonality_config.get('yearly_seasonality', True),
                weekly_seasonality=seasonality_config.get('weekly_seasonality', True),
                daily_seasonality=seasonality_config.get('daily_seasonality', False),
                seasonality_mode=seasonality_config.get('seasonality_mode', 'multiplicative'),
                seasonality_prior_scale=seasonality_config.get('seasonality_prior_scale', 10.0),
                holidays_prior_scale=seasonality_config.get('holidays_prior_scale', 10.0),
                changepoint_prior_scale=seasonality_config.get('changepoint_prior_scale', 0.05),
                interval_width=seasonality_config.get('interval_width', 0.80),
                growth=seasonality_config.get('growth', 'linear')
            )
            
            # Add Indonesian holidays
            holidays = self.add_indonesian_holidays()
            if not holidays.empty:
                model.holidays = holidays
            
            # Add custom seasonalities for Indonesian business
            # Ramadan effect (30-day cycle, varies yearly)
            model.add_seasonality(
                name='ramadan_effect',
                period=355,  # Islamic lunar year
                fourier_order=3,
                prior_scale=5.0
            )
            
            # Payday effect (monthly cycle)
            model.add_seasonality(
                name='monthly_payday',
                period=30.5,
                fourier_order=5,
                prior_scale=8.0
            )
            
            self.model = model
            return model
            
        except Exception as e:
            raise Exception(f"Prophet model creation failed: {str(e)}")
    
    def fit_prophet_model(self, df):
        """
        Fit Prophet model with real implementation
        """
        try:
            if self.model is None:
                self.create_prophet_model()
            
            # Fit the model
            self.fitted_model = self.model.fit(df)
            
            # Generate model diagnostics
            diagnostics = self.generate_model_diagnostics(df)
            
            return {
                'success': True,
                'model_type': 'Prophet',
                'training_data_points': len(df),
                'seasonality_components': self.get_seasonality_components(),
                'diagnostics': diagnostics,
                'changepoints': len(self.fitted_model.changepoints),
                'model_summary': 'Prophet model fitted successfully'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'fallback_used': True
            }
    
    def generate_model_diagnostics(self, df):
        """
        Generate comprehensive model diagnostics
        """
        try:
            # Cross-validation for performance metrics
            if len(df) >= 30:  # Need sufficient data for CV
                cv_results = cross_validation(
                    self.fitted_model, 
                    initial='15 days', 
                    period='7 days', 
                    horizon='7 days'
                )
                
                performance = performance_metrics(cv_results)
                
                return {
                    'cross_validation': True,
                    'mape': float(performance['mape'].mean()),
                    'mae': float(performance['mae'].mean()),
                    'rmse': float(performance['rmse'].mean()),
                    'coverage': float(performance['coverage'].mean()),
                    'cv_periods': len(cv_results['cutoff'].unique())
                }
            else:
                # Simple in-sample metrics for small datasets
                forecast = self.fitted_model.predict(df)
                mape = np.mean(np.abs((df['y'] - forecast['yhat']) / df['y'])) * 100
                mae = np.mean(np.abs(df['y'] - forecast['yhat']))
                
                return {
                    'cross_validation': False,
                    'mape': float(mape),
                    'mae': float(mae),
                    'rmse': float(np.sqrt(np.mean((df['y'] - forecast['yhat']) ** 2))),
                    'in_sample_only': True
                }
                
        except Exception as e:
            return {
                'error': str(e),
                'basic_fit_only': True
            }
    
    def get_seasonality_components(self):
        """
        Extract seasonality components information
        """
        try:
            if self.fitted_model is None:
                return {}
            
            components = []
            
            # Check which seasonalities are present
            for seasonality in self.fitted_model.seasonalities:
                components.append({
                    'name': seasonality,
                    'period': self.fitted_model.seasonalities[seasonality]['period'],
                    'fourier_order': self.fitted_model.seasonalities[seasonality]['fourier_order'],
                    'mode': self.fitted_model.seasonalities[seasonality]['mode']
                })
            
            return {
                'components': components,
                'total_seasonalities': len(components),
                'indonesian_optimized': True
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def forecast(self, periods=30, freq='D', include_history=False):
        """
        Generate Prophet forecasts with comprehensive output
        """
        if self.fitted_model is None:
            raise Exception("Model must be fitted before forecasting")
        
        try:
            # Create future dataframe
            future = self.fitted_model.make_future_dataframe(
                periods=periods, 
                freq=freq, 
                include_history=include_history
            )
            
            # Generate forecast
            forecast = self.fitted_model.predict(future)
            
            # Extract forecast values (only future periods)
            if not include_history:
                forecast_values = forecast.tail(periods)
            else:
                forecast_values = forecast
            
            # Ensure non-negative forecasts for inventory context
            forecast_values['yhat'] = np.maximum(forecast_values['yhat'], 0)
            forecast_values['yhat_lower'] = np.maximum(forecast_values['yhat_lower'], 0)
            forecast_values['yhat_upper'] = np.maximum(forecast_values['yhat_upper'], 0)
            
            # Format forecasts
            forecasts = []
            for i, (_, row) in enumerate(forecast_values.iterrows()):
                forecasts.append({
                    'step': i + 1 if not include_history else None,
                    'date': row['ds'].strftime('%Y-%m-%d'),
                    'forecast': float(row['yhat']),
                    'lower_bound': float(row['yhat_lower']),
                    'upper_bound': float(row['yhat_upper']),
                    'trend': float(row['trend']) if 'trend' in row else None,
                    'seasonal': float(row['seasonal']) if 'seasonal' in row else None,
                    'yearly': float(row['yearly']) if 'yearly' in row else None,
                    'weekly': float(row['weekly']) if 'weekly' in row else None
                })
            
            return {
                'success': True,
                'forecasts': forecasts,
                'forecast_horizon': periods,
                'model_type': 'Prophet',
                'components_included': ['trend', 'seasonal', 'holidays'],
                'indonesian_context': True
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_trend_analysis(self):
        """
        Analyze trend changes and provide business insights
        """
        try:
            if self.fitted_model is None:
                return {'error': 'Model not fitted'}
            
            changepoints = self.fitted_model.changepoints
            trend_changes = []
            
            for cp in changepoints:
                trend_changes.append({
                    'date': cp.strftime('%Y-%m-%d'),
                    'timestamp': cp.timestamp()
                })
            
            return {
                'success': True,
                'changepoints': trend_changes,
                'total_changepoints': len(changepoints),
                'trend_analysis': 'Available'
            }
            
        except Exception as e:
            return {'error': str(e)}


def main():
    """
    Main function for command-line interface
    Expected input format: JSON with data_points, dates, forecast_steps
    """
    try:
        # Read input from command line argument or stdin
        if len(sys.argv) > 1:
            input_data = json.loads(sys.argv[1])
        else:
            input_data = json.loads(sys.stdin.read())
        
        # Extract parameters
        data_points = input_data.get('data_points', [])
        dates = input_data.get('dates', None)
        forecast_steps = input_data.get('forecast_steps', 30)
        include_trend_analysis = input_data.get('include_trend_analysis', True)
        seasonality_config = input_data.get('seasonality_config', None)
        
        # Validate input
        if not data_points or len(data_points) < 10:
            result = {
                'success': False,
                'error': 'Insufficient data points (minimum 10 required)',
                'required_action': 'Collect more historical sales data'
            }
            print(json.dumps(result))
            return
        
        # Initialize Prophet service
        prophet_service = RealProphetService()
        
        # Prepare data
        df = prophet_service.prepare_data(data_points, dates)
        
        # Create and fit model
        prophet_service.create_prophet_model(seasonality_config)
        model_fit = prophet_service.fit_prophet_model(df)
        
        if not model_fit['success']:
            result = {
                'success': False,
                'error': model_fit['error'],
                'fallback_recommendation': 'Use simpler forecasting method'
            }
            print(json.dumps(result))
            return
        
        # Generate forecasts
        forecast_result = prophet_service.forecast(forecast_steps)
        
        # Get trend analysis if requested
        trend_analysis = None
        if include_trend_analysis:
            trend_analysis = prophet_service.get_trend_analysis()
        
        # Compile final result
        result = {
            'success': True,
            'model_type': 'Real_Prophet',
            'data_quality': {
                'data_points': len(data_points),
                'date_range': {
                    'start': df['ds'].min().strftime('%Y-%m-%d'),
                    'end': df['ds'].max().strftime('%Y-%m-%d')
                }
            },
            'model_diagnostics': model_fit,
            'forecasts': forecast_result,
            'trend_analysis': trend_analysis,
            'indonesian_context': {
                'holidays_included': True,
                'business_calendar_applied': True,
                'sme_optimized': True,
                'currency': 'IDR',
                'seasonality_patterns': [
                    'yearly_business_cycle',
                    'weekly_shopping_pattern', 
                    'monthly_payday_effect',
                    'ramadan_effect'
                ]
            },
            'recommendations': [
                'Prophet model excellent for seasonal forecasting',
                'Monitor trend changes and seasonality shifts',
                'Retrain model monthly with new data',
                'Use trend analysis for strategic planning'
            ]
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'recommendations': [
                'Check data format and quality',
                'Ensure sufficient historical data',
                'Verify Prophet dependencies are installed'
            ]
        }
        print(json.dumps(error_result))


if __name__ == "__main__":
    main()