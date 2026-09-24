(function (root) {
  'use strict';

  function cleanName(value) {
    return String(value ?? '')
      .replace(/^\s*บริษัท\s*/u, '')
      .replace(/\s*\(?\s*สำนักงานใหญ่\s*\)?/gu, ' ')
      .replace(/\s*จำกัด(?:\s*\(มหาชน\))?\s*$/u, '')
      .replace(/\s*Co\s*\.?\s*,?\s*Ltd\.?\s*$/iu, '')
      .replace(/\s+/gu, ' ')
      .trim();
  }

  function forProduct(code, data) {
    const key = String(code ?? '').trim().toUpperCase();
    const names = data?.[key] || [];
    return [...new Set(names.map(cleanName).filter(Boolean))];
  }

  const api = {cleanName, forProduct};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PKSupplier = api;
})(typeof window !== 'undefined' ? window : globalThis);
