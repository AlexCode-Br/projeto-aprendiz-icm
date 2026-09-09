export function describeDevice(userAgent = '') {
  const source = String(userAgent);
  const browser = /Edg\//.test(source) ? 'Edge'
    : /OPR\//.test(source) ? 'Opera'
      : /CriOS\//.test(source) ? 'Chrome'
        : /FxiOS\//.test(source) ? 'Firefox'
          : /Firefox\//.test(source) ? 'Firefox'
            : /Chrome\//.test(source) ? 'Chrome'
              : /Safari\//.test(source) ? 'Safari'
                : 'Navegador';
  const system = /Android/i.test(source) ? 'Android'
    : /iPhone|iPad|iPod/i.test(source) ? 'iOS'
      : /Windows/i.test(source) ? 'Windows'
        : /Macintosh|Mac OS X/i.test(source) ? 'macOS'
          : /Linux/i.test(source) ? 'Linux'
            : 'Dispositivo';
  return { browser, system, mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(source), label: `${system} · ${browser}` };
}
