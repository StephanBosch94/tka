(function (root) {
  var k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(bytes) {
    var bitLen = bytes.length * 8;
    var withOne = bytes.length + 1;
    var zeros = (56 - (withOne % 64) + 64) % 64;
    var data = new Uint8Array(withOne + zeros + 8);
    data.set(bytes);
    data[bytes.length] = 0x80;
    var view = new DataView(data.buffer);
    var hi = Math.floor(bitLen / 0x100000000);
    view.setUint32(data.length - 8, hi);
    view.setUint32(data.length - 4, bitLen >>> 0);
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Uint32Array(64);
    for (var offset = 0; offset < data.length; offset += 64) {
      for (var i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
      for (var j = 16; j < 64; j++) {
        var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (var t = 0; t < 64; t++) {
        var s1e = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (hh + s1e + ch + k[t] + w[t]) >>> 0;
        var s0a = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (s0a + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    var out = new Uint8Array(32);
    var outView = new DataView(out.buffer);
    for (var n = 0; n < 8; n++) outView.setUint32(n * 4, h[n]);
    return out;
  }

  function hmac(key, message) {
    if (key.length > 64) key = sha256(key);
    var block = new Uint8Array(64);
    block.set(key);
    var o = new Uint8Array(64);
    var i = new Uint8Array(64);
    for (var n = 0; n < 64; n++) {
      o[n] = block[n] ^ 0x5c;
      i[n] = block[n] ^ 0x36;
    }
    var inner = new Uint8Array(64 + message.length);
    inner.set(i);
    inner.set(message, 64);
    var innerHash = sha256(inner);
    var outer = new Uint8Array(64 + 32);
    outer.set(o);
    outer.set(innerHash, 64);
    return sha256(outer);
  }

  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  function bytesToHex(bytes) {
    var hex = "";
    for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
    return hex;
  }

  function pbkdf2Hex(password, saltHex) {
    var encoder = new TextEncoder();
    var passwordBytes = encoder.encode(password);
    var salt = hexToBytes(saltHex);
    var block = new Uint8Array(salt.length + 4);
    block.set(salt);
    block[salt.length + 3] = 1;
    var u = hmac(passwordBytes, block);
    var result = new Uint8Array(u);
    for (var round = 1; round < 100000; round++) {
      u = hmac(passwordBytes, u);
      for (var b = 0; b < 32; b++) result[b] ^= u[b];
    }
    return bytesToHex(result);
  }

  root.tkaPbkdf2 = pbkdf2Hex;
})(window);
