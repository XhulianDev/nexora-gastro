export const utils = {
  formatMoney: (val) => `${Number.parseFloat(val || 0).toFixed(2)} €`,
  
  formatTime: (val) => {
    const date = new Date(val);
    return isNaN(date) ? '--:--' : date.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' });
  },

  escape: (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  parseItems: (val) => {
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val) || []; } catch { return []; }
  }
};