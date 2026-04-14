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
  },

  optimizeImage: (file, maxSize = 800) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = reject;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas to Blob conversion failed.'));
            return;
          }
          // Change file extension to .webp
          const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
          const optimizedFile = new File([blob], newFileName, {
            type: 'image/webp',
            lastModified: Date.now(),
          });
          resolve(optimizedFile);
        }, 'image/webp', 0.9); // 90% quality
      };
      img.onerror = reject;

      reader.readAsDataURL(file);
    });
  }
};
