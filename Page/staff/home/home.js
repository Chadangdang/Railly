(function () {
  'use strict';

  var videoElement;
  var statusElement;
  var retryButton;
  var mediaStream = null;
  var barcodeDetector = null;
  var jsQrLoader = null;
  var jsQrDetector = null;
  var canvasElement = null;
  var canvasContext = null;
  var scanning = false;
  var detectionFrame = null;
  var hasRedirected = false;
  var lastUnrecognisedAt = 0;

  function setStatus(message, tone) {
    if (!statusElement) {
      return;
    }

    statusElement.textContent = message || '';
    statusElement.classList.remove('is-success', 'is-error', 'is-warning');

    if (tone === 'success') {
      statusElement.classList.add('is-success');
    } else if (tone === 'error') {
      statusElement.classList.add('is-error');
    } else if (tone === 'warning') {
      statusElement.classList.add('is-warning');
    }
  }

  function stopDetectionLoop() {
    scanning = false;
    if (detectionFrame) {
      cancelAnimationFrame(detectionFrame);
      detectionFrame = null;
    }
  }

  function stopCamera() {
    stopDetectionLoop();

    if (videoElement) {
      videoElement.srcObject = null;
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(function (track) {
        track.stop();
      });
      mediaStream = null;
    }
  }

  function ensureDetector() {
    if (barcodeDetector) {
      return Promise.resolve(barcodeDetector);
    }

    if (!('BarcodeDetector' in window)) {
      return ensureJsQrDetector();
    }

    var detectorPromise;

    if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
      detectorPromise = window.BarcodeDetector.getSupportedFormats()
        .then(function (formats) {
          if (Array.isArray(formats) && formats.indexOf('qr_code') === -1) {
            throw new Error('QR format is not supported on this device.');
          }

          return new window.BarcodeDetector({ formats: ['qr_code'] });
        });
    } else {
      detectorPromise = Promise.resolve(new window.BarcodeDetector({ formats: ['qr_code'] }));
    }

    return detectorPromise.then(function (detector) {
      barcodeDetector = detector;
      return detector;
    });
  }

  function ensureJsQrDetector() {
    if (jsQrDetector) {
      return Promise.resolve(jsQrDetector);
    }

    if (!jsQrLoader) {
      jsQrLoader = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = function () {
          reject(new Error('Failed to load QR decoder.'));
        };
        document.head.appendChild(script);
      });
    }

    return jsQrLoader
      .then(function () {
        if (!window.jsQR) {
          throw new Error('QR scanning is not supported on this device.');
        }

        if (!canvasElement) {
          canvasElement = document.createElement('canvas');
          canvasContext = canvasElement.getContext('2d');
        }

        jsQrDetector = {
          detect: function (video) {
            return new Promise(function (resolve) {
              if (!canvasContext || !video) {
                resolve([]);
                return;
              }

              var width = video.videoWidth || video.clientWidth;
              var height = video.videoHeight || video.clientHeight;
              if (!width || !height) {
                resolve([]);
                return;
              }

              canvasElement.width = width;
              canvasElement.height = height;
              canvasContext.drawImage(video, 0, 0, width, height);
              var imageData = canvasContext.getImageData(0, 0, width, height);
              var code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });

              if (code && code.data) {
                resolve([{ rawValue: code.data }]);
                return;
              }

              resolve([]);
            });
          },
        };

        barcodeDetector = jsQrDetector;
        return jsQrDetector;
      })
      .catch(function (error) {
        return Promise.reject(
          error || new Error('QR scanning is not supported on this device.'),
        );
      });
  }

  function parseTicketPayload(rawValue) {
    if (!rawValue) {
      return null;
    }

    var payload = String(rawValue).trim();
    if (!payload) {
      return null;
    }

    function isValid(ticketId, userId) {
      return Boolean(ticketId && userId);
    }

    try {
      var parsedUrl = new URL(payload);
      var ticketId = parsedUrl.searchParams.get('ticket_id');
      var userId = parsedUrl.searchParams.get('user_id');
      if (isValid(ticketId, userId)) {
        return { ticketId: ticketId, userId: userId };
      }
    } catch (error) {
      // Ignore URL parsing errors and try alternative patterns below.
    }

    var query = payload;
    var queryIndex = payload.indexOf('?');
    if (queryIndex !== -1) {
      query = payload.substring(queryIndex + 1);
    }

    try {
      var params = new URLSearchParams(query);
      var ticketIdFromParams = params.get('ticket_id');
      var userIdFromParams = params.get('user_id');
      if (isValid(ticketIdFromParams, userIdFromParams)) {
        return { ticketId: ticketIdFromParams, userId: userIdFromParams };
      }
    } catch (error) {
      // Ignore parsing errors.
    }

    var ticketMatch = payload.match(/ticket[_-]?id[:=]\s*([^&;,\s]+)/i);
    var userMatch = payload.match(/user[_-]?id[:=]\s*([^&;,\s]+)/i);

    if (ticketMatch && userMatch && isValid(ticketMatch[1], userMatch[1])) {
      return { ticketId: ticketMatch[1], userId: userMatch[1] };
    }

    return null;
  }

  function redirectToVerify(info) {
    if (!info || hasRedirected) {
      return;
    }

    hasRedirected = true;
    setStatus('Ticket detected. Opening details…', 'success');

    stopDetectionLoop();
    stopCamera();

    var search = '?ticket_id=' + encodeURIComponent(info.ticketId) +
      '&user_id=' + encodeURIComponent(info.userId);

    window.location.href = '../verify/verify.html' + search;
  }

  function handleUnrecognisedCode() {
    var now = Date.now();
    if (now - lastUnrecognisedAt < 2000) {
      return;
    }

    lastUnrecognisedAt = now;
    setStatus('QR code not recognised. Try adjusting the angle or lighting.', 'warning');
  }

  function runDetectionLoop() {
    if (!scanning || !barcodeDetector || !videoElement) {
      return;
    }

    if (videoElement.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      detectionFrame = requestAnimationFrame(runDetectionLoop);
      return;
    }

    barcodeDetector
      .detect(videoElement)
      .then(function (barcodes) {
        if (!scanning) {
          return;
        }

        if (!Array.isArray(barcodes) || barcodes.length === 0) {
          detectionFrame = requestAnimationFrame(runDetectionLoop);
          return;
        }

        for (var i = 0; i < barcodes.length; i += 1) {
          var barcode = barcodes[i];
          if (!barcode) {
            continue;
          }

          var rawValue = barcode.rawValue || barcode.data || '';
          var parsed = parseTicketPayload(rawValue);
          if (parsed) {
            redirectToVerify(parsed);
            return;
          }
        }

        handleUnrecognisedCode();
        detectionFrame = requestAnimationFrame(runDetectionLoop);
      })
      .catch(function (error) {
        if (console && typeof console.error === 'function') {
          console.error(error);
        }
        setStatus('Unable to read the QR code. Hold steady and try again.', 'warning');
        detectionFrame = requestAnimationFrame(runDetectionLoop);
      });
  }

  function startDetection() {
    if (scanning) {
      return;
    }

    scanning = true;
    detectionFrame = requestAnimationFrame(runDetectionLoop);
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Camera access is not supported on this device.', 'error');
      if (retryButton) {
        retryButton.hidden = false;
        retryButton.disabled = false;
      }
      return Promise.reject(new Error('getUserMedia is not supported.'));
    }

    stopCamera();
    hasRedirected = false;
    lastUnrecognisedAt = 0;

    if (retryButton) {
      retryButton.hidden = true;
      retryButton.disabled = true;
    }

    setStatus('Opening camera…');

    return navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then(function (stream) {
        mediaStream = stream;
        if (videoElement) {
          videoElement.srcObject = stream;
          return videoElement.play().catch(function () {
            // Ignore play errors; autoplay policies may block it until user interaction.
          });
        }
        return undefined;
      })
      .then(function () {
        return ensureDetector();
      })
      .then(function () {
        setStatus('Point the camera at the passenger QR code.');
        startDetection();
        if (retryButton) {
          retryButton.hidden = true;
          retryButton.disabled = false;
        }
      })
      .catch(function (error) {
        stopCamera();
        if (retryButton) {
          retryButton.hidden = false;
          retryButton.disabled = false;
        }

        var message = 'Unable to access the camera. Please check permissions and try again.';
        if (error && error.message) {
          if (error.message.indexOf('denied') !== -1 || error.name === 'NotAllowedError') {
            message = 'Camera access was denied. Enable permissions and try again.';
          } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
            message = 'No suitable camera found. Connect a camera or try a different device.';
          } else if (error.message) {
            message = error.message;
          }
        }

        setStatus(message, 'error');
        return Promise.reject(error);
      });
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stopDetectionLoop();
    } else if (mediaStream && !scanning && !hasRedirected) {
      startDetection();
    }
  }

  function initialise() {
    videoElement = document.getElementById('camera-stream');
    statusElement = document.getElementById('scan-status');
    retryButton = document.getElementById('retry-camera');

    if (!videoElement || !statusElement) {
      return;
    }

    if (retryButton) {
      retryButton.addEventListener('click', function () {
        if (retryButton.disabled) {
          return;
        }

        retryButton.disabled = true;
        startCamera().finally(function () {
          if (retryButton) {
            retryButton.disabled = false;
          }
        });
      });
    }

    startCamera();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', stopCamera);
    window.addEventListener('beforeunload', stopCamera);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }
})();
