// src/utils/file.js
export const readFileAsBuffer = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result); // ArrayBuffer
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsArrayBuffer(file);
  });
};


export const readFileAsBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);  // Base64 string
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
