import apiClient from './api';

export const paymentService = {
  /**
   * Initializes a payment session on the backend
   * @param email User's email
   * @returns { provider, paymentUrl }
   */
  initializePayment: async (email?: string) => {
    try {
      const response = await apiClient.post('/payments/initialize', { email });
      return response.data.data;
    } catch (error) {
      console.error('Failed to initialize payment:', error);
      throw error;
    }
  },

  /**
   * Fetches the current subscription status
   * @returns { plan, status, provider, currentPeriodEnd }
   */
  getSubscriptionStatus: async () => {
    try {
      const response = await apiClient.get('/payments/subscription-status');
      return response.data.data?.subscription;
    } catch (error) {
      console.error('Failed to get subscription status:', error);
      throw error;
    }
  },

  /**
   * Cancels the active subscription
   */
  cancelSubscription: async () => {
    try {
      const response = await apiClient.post('/payments/cancel');
      return response.data;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }
};
