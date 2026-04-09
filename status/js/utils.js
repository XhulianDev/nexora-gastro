export const toNumber = (v) => {
  const parsed = parseFloat(v);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Për raste si "10.00 €"
export const formatMoney = (v) => `${toNumber(v).toFixed(2)} €`;

// Për raste më kompakte në rreshtat e produkteve: "10.00€"
export const formatMoneyCompact = (v) => `${toNumber(v).toFixed(2)}€`;

export const escapeHtml = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
};

export const getActiveOrderIds = (key) => {
  try {
    const data = localStorage.getItem(key);
    const parsed = JSON.parse(data || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { 
    return []; 
  }
};

// Ky funksion është i domosdoshëm për të pastruar ID-të nga URL
export const parsePositiveInteger = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};