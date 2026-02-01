const axios = require('axios');

// PayPal Configuration
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox'; // 'sandbox' or 'live'
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

const PAYPAL_API_BASE = PAYPAL_MODE === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

// Generate PayPal access token
const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error('PayPal credentials not configured');
    }

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios({
      url: `${PAYPAL_API_BASE}/v1/oauth2/token`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      data: 'grant_type=client_credentials'
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error generating PayPal access token:', error.response?.data || error.message);
    throw error;
  }
};

// Create PayPal order
const createOrder = async (amount, currency = 'USD') => {
  try {
    const accessToken = await generateAccessToken();

    const response = await axios({
      url: `${PAYPAL_API_BASE}/v2/checkout/orders`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      data: {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: parseFloat(amount).toFixed(2)
          }
        }],
        application_context: {
          return_url: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/paypal/success`,
          cancel_url: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/paypal/cancel`,
          brand_name: 'TapPark',
          user_action: 'PAY_NOW'
        }
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error creating PayPal order:', error.response?.data || error.message);
    throw error;
  }
};

// Capture PayPal order
const captureOrder = async (orderId) => {
  try {
    const accessToken = await generateAccessToken();

    const response = await axios({
      url: `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error capturing PayPal order:', error.response?.data || error.message);
    throw error;
  }
};

// Get order details
const getOrderDetails = async (orderId) => {
  try {
    const accessToken = await generateAccessToken();

    const response = await axios({
      url: `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error getting PayPal order details:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  generateAccessToken,
  createOrder,
  captureOrder,
  getOrderDetails,
  PAYPAL_MODE,
  PAYPAL_API_BASE
};
