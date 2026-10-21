/*
 * Gerador de BR Code (PIX estático) — padrão EMV® QRCPS-MPM.
 * Implementação sem dependências, com CRC16-CCITT (0x1021).
 *
 * Observação: o QR Code gerado é um PIX estático com valor. A confirmação
 * do pagamento é manual, pela conferência do comprovante enviado no WhatsApp.
 */
(function (global) {
  'use strict';

  function ascii(value, maxLength) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  function tlv(id, value) {
    var text = String(value);
    var length = text.length;
    if (length > 99) {
      throw new Error('Campo PIX muito longo: ' + id);
    }
    return id + String(length).padStart(2, '0') + text;
  }

  function crc16(payload) {
    var crc = 0xffff;
    for (var i = 0; i < payload.length; i += 1) {
      crc ^= payload.charCodeAt(i) << 8;
      for (var bit = 0; bit < 8; bit += 1) {
        crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function buildPixPayload(options) {
    var opts = options || {};
    var key = ascii(opts.key, 77);
    if (!key) {
      throw new Error('Chave PIX não informada.');
    }

    var merchantName = ascii(opts.merchantName || 'AKYLLA SHOP', 25).toUpperCase();
    var merchantCity = ascii(opts.city || 'GOIANIA', 15).toUpperCase();
    var description = ascii(opts.description || '', 40);
    var txid = String(opts.txid || '***')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 25) || '***';

    var merchantAccount = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', key);
    if (description) {
      merchantAccount += tlv('02', description);
    }

    var payload = tlv('00', '01');
    payload += tlv('26', merchantAccount);
    payload += tlv('52', '0000');
    payload += tlv('53', '986');

    if (opts.amountCents != null) {
      var cents = Math.round(Number(opts.amountCents));
      if (!Number.isFinite(cents) || cents < 0) {
        throw new Error('Valor inválido para o PIX.');
      }
      payload += tlv('54', (cents / 100).toFixed(2));
    }

    payload += tlv('58', 'BR');
    payload += tlv('59', merchantName);
    payload += tlv('60', merchantCity);
    payload += tlv('62', tlv('05', txid));
    payload += '6304';

    return payload + crc16(payload);
  }

  function parseTLV(payload) {
    var fields = {};
    var index = 0;
    while (index < payload.length) {
      var id = payload.slice(index, index + 2);
      var length = Number(payload.slice(index + 2, index + 4));
      if (!/^\d{2}$/.test(id) || !Number.isFinite(length)) {
        throw new Error('Payload inválido perto do índice ' + index);
      }
      fields[id] = payload.slice(index + 4, index + 4 + length);
      index += 4 + length;
    }
    return fields;
  }

  function validatePixPayload(payload) {
    if (payload.slice(-8, -4) !== '6304') {
      return { valid: false, reason: 'Campo CRC ausente.' };
    }
    var expected = crc16(payload.slice(0, -4));
    var actual = payload.slice(-4).toUpperCase();
    if (expected !== actual) {
      return { valid: false, reason: 'CRC inválido.', expected: expected, actual: actual };
    }
    return { valid: true, fields: parseTLV(payload.slice(0, -4)) };
  }

  global.AkyllaPix = {
    buildPixPayload: buildPixPayload,
    crc16: crc16,
    parseTLV: parseTLV,
    validatePixPayload: validatePixPayload
  };
})(window);
