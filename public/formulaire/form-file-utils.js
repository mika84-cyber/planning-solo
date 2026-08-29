export function humanFileSize(size) {
  return size > 1048576
    ? (size / 1048576).toFixed(1).replace('.', ',') + ' Mo'
    : Math.max(1, Math.round(size / 1024)) + ' Ko';
}

export function readImageAttachment(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onerror = function () { reject(new Error('lecture impossible')); };
    reader.onload = function () {
      var image = new Image();
      image.onerror = function () { reject(new Error('format d’image non reconnu')); };
      image.onload = function () {
        var maximum = 1800, scale = Math.min(1, maximum / Math.max(image.width, image.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        var context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error('conversion impossible'));
          blob.arrayBuffer().then(function (bytes) {
            resolve({ kind: 'img', bytes: bytes, w: canvas.width, h: canvas.height });
          });
        }, 'image/jpeg', 0.85);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function readFileArrayBuffer(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onerror = function () { reject(new Error('lecture du fichier impossible')); };
    reader.onload = function () { resolve(reader.result); };
    reader.readAsArrayBuffer(file);
  });
}

export function findPdfHeader(bytes) {
  var maximum = Math.min(bytes.length - 3, 4096);
  for (var index = 0; index < maximum; index++) {
    if (bytes[index] === 0x25 && bytes[index + 1] === 0x50 && bytes[index + 2] === 0x44 && bytes[index + 3] === 0x46) return index;
  }
  return -1;
}
