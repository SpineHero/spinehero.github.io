/*!
 * @preserve
 * jquery.scrolldepth.js | v0.9.1
 * Copyright (c) 2016 Rob Flaherty (@robflaherty)
 * Licensed under the MIT and GPL licenses.
 */

/* Universal module definition */

(function(factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['jquery'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS
    module.exports = factory(require('jquery'));
  } else {
    // Browser globals
    factory(jQuery);
  }
}(function($) {

/* Scroll Depth */

    "use strict";

    var defaults = {
      minHeight: 0,
      elements: [],
      percentage: true,
      userTiming: true,
      pixelDepth: true,
      nonInteraction: true,
      gaGlobal: false,
      gtmOverride: false
    };

    var $window = $(window),
      cache = [],
      scrollEventBound = false,
      lastPixelDepth = 0,
      universalGA,
      classicGA,
      gaGlobal,
      standardEventHandler;

    /*
     * Plugin
     */

    $.scrollDepth = function(options) {

      var startTime = +new Date;

      options = $.extend({}, defaults, options);

      // Return early if document height is too small
      if ( $(document).height() < options.minHeight ) {
        return;
      }

      /*
       * Determine which version of GA is being used
       * "ga", "__gaTracker", _gaq", and "dataLayer" are the possible globals
       */

      if (options.gaGlobal) {
        universalGA = true;
        gaGlobal = options.gaGlobal;
      } else if (typeof ga === "function") {
        universalGA = true;
        gaGlobal = 'ga';
      } else if (typeof __gaTracker === "function") {
        universalGA = true;
        gaGlobal = '__gaTracker';
      }

      if (typeof _gaq !== "undefined" && typeof _gaq.push === "function") {
        classicGA = true;
      }

      if (typeof options.eventHandler === "function") {
        standardEventHandler = options.eventHandler;
      } else if (typeof dataLayer !== "undefined" && typeof dataLayer.push === "function" && !options.gtmOverride) {

        standardEventHandler = function(data) {
          dataLayer.push(data);
        };
      }

      /*
       * Functions
       */

      function sendEvent(action, label, scrollDistance, timing) {

        if (standardEventHandler) {

          standardEventHandler({'event': 'ScrollDistance', 'eventCategory': 'Scroll Depth', 'eventAction': action, 'eventLabel': label, 'eventValue': 1, 'eventNonInteraction': options.nonInteraction});

          if (options.pixelDepth && arguments.length > 2 && scrollDistance > lastPixelDepth) {
            lastPixelDepth = scrollDistance;
            standardEventHandler({'event': 'ScrollDistance', 'eventCategory': 'Scroll Depth', 'eventAction': 'Pixel Depth', 'eventLabel': rounded(scrollDistance), 'eventValue': 1, 'eventNonInteraction': options.nonInteraction});
          }

          if (options.userTiming && arguments.length > 3) {
            standardEventHandler({'event': 'ScrollTiming', 'eventCategory': 'Scroll Depth', 'eventAction': action, 'eventLabel': label, 'eventTiming': timing});
          }

        } else {

          if (universalGA) {

            window[gaGlobal]('send', 'event', 'Scroll Depth', action, label, 1, {'nonInteraction': options.nonInteraction});

            if (options.pixelDepth && arguments.length > 2 && scrollDistance > lastPixelDepth) {
              lastPixelDepth = scrollDistance;
              window[gaGlobal]('send', 'event', 'Scroll Depth', 'Pixel Depth', rounded(scrollDistance), 1, {'nonInteraction': options.nonInteraction});
            }

            if (options.userTiming && arguments.length > 3) {
              window[gaGlobal]('send', 'timing', 'Scroll Depth', action, timing, label);
            }

          }

          if (classicGA) {

            _gaq.push(['_trackEvent', 'Scroll Depth', action, label, 1, options.nonInteraction]);

            if (options.pixelDepth && arguments.length > 2 && scrollDistance > lastPixelDepth) {
              lastPixelDepth = scrollDistance;
              _gaq.push(['_trackEvent', 'Scroll Depth', 'Pixel Depth', rounded(scrollDistance), 1, options.nonInteraction]);
            }

            if (options.userTiming && arguments.length > 3) {
              _gaq.push(['_trackTiming', 'Scroll Depth', action, timing, label, 100]);
            }

          }

        }

      }

      function calculateMarks(docHeight) {
        return {
          '25%' : parseInt(docHeight * 0.25, 10),
          '50%' : parseInt(docHeight * 0.50, 10),
          '75%' : parseInt(docHeight * 0.75, 10),
          // Cushion to trigger 100% event in iOS
          '100%': docHeight - 5
        };
      }

      function checkMarks(marks, scrollDistance, timing) {
        // Check each active mark
        $.each(marks, function(key, val) {
          if ( $.inArray(key, cache) === -1 && scrollDistance >= val ) {
            sendEvent('Percentage', key, scrollDistance, timing);
            cache.push(key);
          }
        });
      }

      function checkElements(elements, scrollDistance, timing) {
        $.each(elements, function(index, elem) {
          if ( $.inArray(elem, cache) === -1 && $(elem).length ) {
            if ( scrollDistance >= $(elem).offset().top ) {
              sendEvent('Elements', elem, scrollDistance, timing);
              cache.push(elem);
            }
          }
        });
      }

      function rounded(scrollDistance) {
        // Returns String
        return (Math.floor(scrollDistance/250) * 250).toString();
      }

      function init() {
        bindScrollDepth();
      }

      /*
       * Public Methods
       */

      // Reset Scroll Depth with the originally initialized options
      $.scrollDepth.reset = function() {
        cache = [];
        lastPixelDepth = 0;
        $window.off('scroll.scrollDepth');
        bindScrollDepth();
      };

      // Add DOM elements to be tracked
      $.scrollDepth.addElements = function(elems) {

        if (typeof elems == "undefined" || !$.isArray(elems)) {
          return;
        }

        $.merge(options.elements, elems);

        // If scroll event has been unbound from window, rebind
        if (!scrollEventBound) {
          bindScrollDepth();
        }

      };

      // Remove DOM elements currently tracked
      $.scrollDepth.removeElements = function(elems) {

        if (typeof elems == "undefined" || !$.isArray(elems)) {
          return;
        }

        $.each(elems, function(index, elem) {

          var inElementsArray = $.inArray(elem, options.elements);
          var inCacheArray = $.inArray(elem, cache);

          if (inElementsArray != -1) {
            options.elements.splice(inElementsArray, 1);
          }

          if (inCacheArray != -1) {
            cache.splice(inCacheArray, 1);
          }

        });

      };

      /*
       * Throttle function borrowed from:
       * Underscore.js 1.5.2
       * http://underscorejs.org
       * (c) 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
       * Underscore may be freely distributed under the MIT license.
       */

      function throttle(func, wait) {
        var context, args, result;
        var timeout = null;
        var previous = 0;
        var later = function() {
          previous = new Date;
          timeout = null;
          result = func.apply(context, args);
        };
        return function() {
          var now = new Date;
          if (!previous) previous = now;
          var remaining = wait - (now - previous);
          context = this;
          args = arguments;
          if (remaining <= 0) {
            clearTimeout(timeout);
            timeout = null;
            previous = now;
            result = func.apply(context, args);
          } else if (!timeout) {
            timeout = setTimeout(later, remaining);
          }
          return result;
        };
      }

      /*
       * Scroll Event
       */

      function bindScrollDepth() {

        scrollEventBound = true;

        $window.on('scroll.scrollDepth', throttle(function() {
          /*
           * We calculate document and window height on each scroll event to
           * account for dynamic DOM changes.
           */

          var docHeight = $(document).height(),
            winHeight = window.innerHeight ? window.innerHeight : $window.height(),
            scrollDistance = $window.scrollTop() + winHeight,

            // Recalculate percentage marks
            marks = calculateMarks(docHeight),

            // Timing
            timing = +new Date - startTime;

          // If all marks already hit, unbind scroll event
          if (cache.length >= options.elements.length + (options.percentage ? 4:0)) {
            $window.off('scroll.scrollDepth');
            scrollEventBound = false;
            return;
          }

          // Check specified DOM elements
          if (options.elements) {
            checkElements(options.elements, scrollDistance, timing);
          }

          // Check standard marks
          if (options.percentage) {
            checkMarks(marks, scrollDistance, timing);
          }
        }, 500));

      }

      init();

    };

}));
// using jQuery
function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie != '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = jQuery.trim(cookies[i]);
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) == (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

var csrftoken = getCookie('csrftoken');

function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
    }
});
/*!
 * Lightbox v2.9.0
 * by Lokesh Dhakar
 *
 * More info:
 * http://lokeshdhakar.com/projects/lightbox2/
 *
 * Copyright 2007, 2015 Lokesh Dhakar
 * Released under the MIT license
 * https://github.com/lokesh/lightbox2/blob/master/LICENSE
 */

// Uses Node, AMD or browser globals to create a module.
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require('jquery'));
    } else {
        // Browser globals (root is window)
        root.lightbox = factory(root.jQuery);
    }
}(this, function ($) {

  function Lightbox(options) {
    this.album = [];
    this.currentImageIndex = void 0;
    this.init();

    // options
    this.options = $.extend({}, this.constructor.defaults);
    this.option(options);
  }

  // Descriptions of all options available on the demo site:
  // http://lokeshdhakar.com/projects/lightbox2/index.html#options
  Lightbox.defaults = {
    albumLabel: 'Image %1 of %2',
    alwaysShowNavOnTouchDevices: false,
    fadeDuration: 600,
    fitImagesInViewport: true,
    imageFadeDuration: 600,
    // maxWidth: 800,
    // maxHeight: 600,
    positionFromTop: 50,
    resizeDuration: 700,
    showImageNumberLabel: true,
    wrapAround: false,
    disableScrolling: false,
    /*
    Sanitize Title
    If the caption data is trusted, for example you are hardcoding it in, then leave this to false.
    This will free you to add html tags, such as links, in the caption.

    If the caption data is user submitted or from some other untrusted source, then set this to true
    to prevent xss and other injection attacks.
     */
    sanitizeTitle: false
  };

  Lightbox.prototype.option = function(options) {
    $.extend(this.options, options);
  };

  Lightbox.prototype.imageCountLabel = function(currentImageNum, totalImages) {
    return this.options.albumLabel.replace(/%1/g, currentImageNum).replace(/%2/g, totalImages);
  };

  Lightbox.prototype.init = function() {
    var self = this;
    // Both enable and build methods require the body tag to be in the DOM.
    $(document).ready(function() {
      self.enable();
      self.build();
    });
  };

  // Loop through anchors and areamaps looking for either data-lightbox attributes or rel attributes
  // that contain 'lightbox'. When these are clicked, start lightbox.
  Lightbox.prototype.enable = function() {
    var self = this;
    $('body').on('click', 'a[rel^=lightbox], area[rel^=lightbox], a[data-lightbox], area[data-lightbox]', function(event) {
      self.start($(event.currentTarget));
      return false;
    });
  };

  // Build html for the lightbox and the overlay.
  // Attach event handlers to the new DOM elements. click click click
  Lightbox.prototype.build = function() {
    var self = this;
    $('<div id="lightboxOverlay" class="lightboxOverlay"></div><div id="lightbox" class="lightbox"><div class="lb-outerContainer"><div class="lb-container"><img class="lb-image" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" /><div class="lb-nav"><a class="lb-prev" href="" ></a><a class="lb-next" href="" ></a></div><div class="lb-loader"><a class="lb-cancel"></a></div></div></div><div class="lb-dataContainer"><div class="lb-data"><div class="lb-details"><span class="lb-caption"></span><span class="lb-number"></span></div><div class="lb-closeContainer"><a class="lb-close"></a></div></div></div></div>').appendTo($('body'));

    // Cache jQuery objects
    this.$lightbox       = $('#lightbox');
    this.$overlay        = $('#lightboxOverlay');
    this.$outerContainer = this.$lightbox.find('.lb-outerContainer');
    this.$container      = this.$lightbox.find('.lb-container');
    this.$image          = this.$lightbox.find('.lb-image');
    this.$nav            = this.$lightbox.find('.lb-nav');

    // Store css values for future lookup
    this.containerPadding = {
      top: parseInt(this.$container.css('padding-top'), 10),
      right: parseInt(this.$container.css('padding-right'), 10),
      bottom: parseInt(this.$container.css('padding-bottom'), 10),
      left: parseInt(this.$container.css('padding-left'), 10)
    };

    this.imageBorderWidth = {
      top: parseInt(this.$image.css('border-top-width'), 10),
      right: parseInt(this.$image.css('border-right-width'), 10),
      bottom: parseInt(this.$image.css('border-bottom-width'), 10),
      left: parseInt(this.$image.css('border-left-width'), 10)
    };

    // Attach event handlers to the newly minted DOM elements
    this.$overlay.hide().on('click', function() {
      self.end();
      return false;
    });

    this.$lightbox.hide().on('click', function(event) {
      if ($(event.target).attr('id') === 'lightbox') {
        self.end();
      }
      return false;
    });

    this.$outerContainer.on('click', function(event) {
      if ($(event.target).attr('id') === 'lightbox') {
        self.end();
      }
      return false;
    });

    this.$lightbox.find('.lb-prev').on('click', function() {
      if (self.currentImageIndex === 0) {
        self.changeImage(self.album.length - 1);
      } else {
        self.changeImage(self.currentImageIndex - 1);
      }
      return false;
    });

    this.$lightbox.find('.lb-next').on('click', function() {
      if (self.currentImageIndex === self.album.length - 1) {
        self.changeImage(0);
      } else {
        self.changeImage(self.currentImageIndex + 1);
      }
      return false;
    });

    /*
      Show context menu for image on right-click

      There is a div containing the navigation that spans the entire image and lives above of it. If
      you right-click, you are right clicking this div and not the image. This prevents users from
      saving the image or using other context menu actions with the image.

      To fix this, when we detect the right mouse button is pressed down, but not yet clicked, we
      set pointer-events to none on the nav div. This is so that the upcoming right-click event on
      the next mouseup will bubble down to the image. Once the right-click/contextmenu event occurs
      we set the pointer events back to auto for the nav div so it can capture hover and left-click
      events as usual.
     */
    this.$nav.on('mousedown', function(event) {
      if (event.which === 3) {
        self.$nav.css('pointer-events', 'none');

        self.$lightbox.one('contextmenu', function() {
          setTimeout(function() {
              this.$nav.css('pointer-events', 'auto');
          }.bind(self), 0);
        });
      }
    });


    this.$lightbox.find('.lb-loader, .lb-close').on('click', function() {
      self.end();
      return false;
    });
  };

  // Show overlay and lightbox. If the image is part of a set, add siblings to album array.
  Lightbox.prototype.start = function($link) {
    var self    = this;
    var $window = $(window);

    $window.on('resize', $.proxy(this.sizeOverlay, this));

    $('select, object, embed').css({
      visibility: 'hidden'
    });

    this.sizeOverlay();

    this.album = [];
    var imageNumber = 0;

    function addToAlbum($link) {
      self.album.push({
        link: $link.attr('href'),
        title: $link.attr('data-title') || $link.attr('title')
      });
    }

    // Support both data-lightbox attribute and rel attribute implementations
    var dataLightboxValue = $link.attr('data-lightbox');
    var $links;

    if (dataLightboxValue) {
      $links = $($link.prop('tagName') + '[data-lightbox="' + dataLightboxValue + '"]');
      for (var i = 0; i < $links.length; i = ++i) {
        addToAlbum($($links[i]));
        if ($links[i] === $link[0]) {
          imageNumber = i;
        }
      }
    } else {
      if ($link.attr('rel') === 'lightbox') {
        // If image is not part of a set
        addToAlbum($link);
      } else {
        // If image is part of a set
        $links = $($link.prop('tagName') + '[rel="' + $link.attr('rel') + '"]');
        for (var j = 0; j < $links.length; j = ++j) {
          addToAlbum($($links[j]));
          if ($links[j] === $link[0]) {
            imageNumber = j;
          }
        }
      }
    }

    // Position Lightbox
    var top  = $window.scrollTop() + this.options.positionFromTop;
    var left = $window.scrollLeft();
    this.$lightbox.css({
      top: top + 'px',
      left: left + 'px'
    }).fadeIn(this.options.fadeDuration);

    // Disable scrolling of the page while open
    if (this.options.disableScrolling) {
      $('body').addClass('lb-disable-scrolling');
    }

    this.changeImage(imageNumber);
  };

  // Hide most UI elements in preparation for the animated resizing of the lightbox.
  Lightbox.prototype.changeImage = function(imageNumber) {
    var self = this;

    this.disableKeyboardNav();
    var $image = this.$lightbox.find('.lb-image');

    this.$overlay.fadeIn(this.options.fadeDuration);

    $('.lb-loader').fadeIn('slow');
    this.$lightbox.find('.lb-image, .lb-nav, .lb-prev, .lb-next, .lb-dataContainer, .lb-numbers, .lb-caption').hide();

    this.$outerContainer.addClass('animating');

    // When image to show is preloaded, we send the width and height to sizeContainer()
    var preloader = new Image();
    preloader.onload = function() {
      var $preloader;
      var imageHeight;
      var imageWidth;
      var maxImageHeight;
      var maxImageWidth;
      var windowHeight;
      var windowWidth;

      $image.attr('src', self.album[imageNumber].link);

      $preloader = $(preloader);

      $image.width(preloader.width);
      $image.height(preloader.height);

      if (self.options.fitImagesInViewport) {
        // Fit image inside the viewport.
        // Take into account the border around the image and an additional 10px gutter on each side.

        windowWidth    = $(window).width();
        windowHeight   = $(window).height();
        maxImageWidth  = windowWidth - self.containerPadding.left - self.containerPadding.right - self.imageBorderWidth.left - self.imageBorderWidth.right - 20;
        maxImageHeight = windowHeight - self.containerPadding.top - self.containerPadding.bottom - self.imageBorderWidth.top - self.imageBorderWidth.bottom - 120;

        // Check if image size is larger then maxWidth|maxHeight in settings
        if (self.options.maxWidth && self.options.maxWidth < maxImageWidth) {
          maxImageWidth = self.options.maxWidth;
        }
        if (self.options.maxHeight && self.options.maxHeight < maxImageWidth) {
          maxImageHeight = self.options.maxHeight;
        }

        // Is there a fitting issue?
        if ((preloader.width > maxImageWidth) || (preloader.height > maxImageHeight)) {
          if ((preloader.width / maxImageWidth) > (preloader.height / maxImageHeight)) {
            imageWidth  = maxImageWidth;
            imageHeight = parseInt(preloader.height / (preloader.width / imageWidth), 10);
            $image.width(imageWidth);
            $image.height(imageHeight);
          } else {
            imageHeight = maxImageHeight;
            imageWidth = parseInt(preloader.width / (preloader.height / imageHeight), 10);
            $image.width(imageWidth);
            $image.height(imageHeight);
          }
        }
      }
      self.sizeContainer($image.width(), $image.height());
    };

    preloader.src          = this.album[imageNumber].link;
    this.currentImageIndex = imageNumber;
  };

  // Stretch overlay to fit the viewport
  Lightbox.prototype.sizeOverlay = function() {
    this.$overlay
      .width($(document).width())
      .height($(document).height());
  };

  // Animate the size of the lightbox to fit the image we are showing
  Lightbox.prototype.sizeContainer = function(imageWidth, imageHeight) {
    var self = this;

    var oldWidth  = this.$outerContainer.outerWidth();
    var oldHeight = this.$outerContainer.outerHeight();
    var newWidth  = imageWidth + this.containerPadding.left + this.containerPadding.right + this.imageBorderWidth.left + this.imageBorderWidth.right;
    var newHeight = imageHeight + this.containerPadding.top + this.containerPadding.bottom + this.imageBorderWidth.top + this.imageBorderWidth.bottom;

    function postResize() {
      self.$lightbox.find('.lb-dataContainer').width(newWidth);
      self.$lightbox.find('.lb-prevLink').height(newHeight);
      self.$lightbox.find('.lb-nextLink').height(newHeight);
      self.showImage();
    }

    if (oldWidth !== newWidth || oldHeight !== newHeight) {
      this.$outerContainer.animate({
        width: newWidth,
        height: newHeight
      }, this.options.resizeDuration, 'swing', function() {
        postResize();
      });
    } else {
      postResize();
    }
  };

  // Display the image and its details and begin preload neighboring images.
  Lightbox.prototype.showImage = function() {
    this.$lightbox.find('.lb-loader').stop(true).hide();
    this.$lightbox.find('.lb-image').fadeIn(this.options.imageFadeDuration);

    this.updateNav();
    this.updateDetails();
    this.preloadNeighboringImages();
    this.enableKeyboardNav();
  };

  // Display previous and next navigation if appropriate.
  Lightbox.prototype.updateNav = function() {
    // Check to see if the browser supports touch events. If so, we take the conservative approach
    // and assume that mouse hover events are not supported and always show prev/next navigation
    // arrows in image sets.
    var alwaysShowNav = false;
    try {
      document.createEvent('TouchEvent');
      alwaysShowNav = (this.options.alwaysShowNavOnTouchDevices) ? true : false;
    } catch (e) {}

    this.$lightbox.find('.lb-nav').show();

    if (this.album.length > 1) {
      if (this.options.wrapAround) {
        if (alwaysShowNav) {
          this.$lightbox.find('.lb-prev, .lb-next').css('opacity', '1');
        }
        this.$lightbox.find('.lb-prev, .lb-next').show();
      } else {
        if (this.currentImageIndex > 0) {
          this.$lightbox.find('.lb-prev').show();
          if (alwaysShowNav) {
            this.$lightbox.find('.lb-prev').css('opacity', '1');
          }
        }
        if (this.currentImageIndex < this.album.length - 1) {
          this.$lightbox.find('.lb-next').show();
          if (alwaysShowNav) {
            this.$lightbox.find('.lb-next').css('opacity', '1');
          }
        }
      }
    }
  };

  // Display caption, image number, and closing button.
  Lightbox.prototype.updateDetails = function() {
    var self = this;

    // Enable anchor clicks in the injected caption html.
    // Thanks Nate Wright for the fix. @https://github.com/NateWr
    if (typeof this.album[this.currentImageIndex].title !== 'undefined' &&
      this.album[this.currentImageIndex].title !== '') {
      var $caption = this.$lightbox.find('.lb-caption');
      if (this.options.sanitizeTitle) {
        $caption.text(this.album[this.currentImageIndex].title);
      } else {
        $caption.html(this.album[this.currentImageIndex].title);
      }
      $caption.fadeIn('fast')
        .find('a').on('click', function(event) {
          if ($(this).attr('target') !== undefined) {
            window.open($(this).attr('href'), $(this).attr('target'));
          } else {
            location.href = $(this).attr('href');
          }
        });
    }

    if (this.album.length > 1 && this.options.showImageNumberLabel) {
      var labelText = this.imageCountLabel(this.currentImageIndex + 1, this.album.length);
      this.$lightbox.find('.lb-number').text(labelText).fadeIn('fast');
    } else {
      this.$lightbox.find('.lb-number').hide();
    }

    this.$outerContainer.removeClass('animating');

    this.$lightbox.find('.lb-dataContainer').fadeIn(this.options.resizeDuration, function() {
      return self.sizeOverlay();
    });
  };

  // Preload previous and next images in set.
  Lightbox.prototype.preloadNeighboringImages = function() {
    if (this.album.length > this.currentImageIndex + 1) {
      var preloadNext = new Image();
      preloadNext.src = this.album[this.currentImageIndex + 1].link;
    }
    if (this.currentImageIndex > 0) {
      var preloadPrev = new Image();
      preloadPrev.src = this.album[this.currentImageIndex - 1].link;
    }
  };

  Lightbox.prototype.enableKeyboardNav = function() {
    $(document).on('keyup.keyboard', $.proxy(this.keyboardAction, this));
  };

  Lightbox.prototype.disableKeyboardNav = function() {
    $(document).off('.keyboard');
  };

  Lightbox.prototype.keyboardAction = function(event) {
    var KEYCODE_ESC        = 27;
    var KEYCODE_LEFTARROW  = 37;
    var KEYCODE_RIGHTARROW = 39;

    var keycode = event.keyCode;
    var key     = String.fromCharCode(keycode).toLowerCase();
    if (keycode === KEYCODE_ESC || key.match(/x|o|c/)) {
      this.end();
    } else if (key === 'p' || keycode === KEYCODE_LEFTARROW) {
      if (this.currentImageIndex !== 0) {
        this.changeImage(this.currentImageIndex - 1);
      } else if (this.options.wrapAround && this.album.length > 1) {
        this.changeImage(this.album.length - 1);
      }
    } else if (key === 'n' || keycode === KEYCODE_RIGHTARROW) {
      if (this.currentImageIndex !== this.album.length - 1) {
        this.changeImage(this.currentImageIndex + 1);
      } else if (this.options.wrapAround && this.album.length > 1) {
        this.changeImage(0);
      }
    }
  };

  // Closing time. :-(
  Lightbox.prototype.end = function() {
    this.disableKeyboardNav();
    $(window).off('resize', this.sizeOverlay);
    this.$lightbox.fadeOut(this.options.fadeDuration);
    this.$overlay.fadeOut(this.options.fadeDuration);
    $('select, object, embed').css({
      visibility: 'visible'
    });
    if (this.options.disableScrolling) {
      $('body').removeClass('lb-disable-scrolling');
    }
  };

  return new Lightbox();
}));

$(document).ready(function () {
    // Initialize GA plugin 'Scroll Depth'
    $.scrollDepth({
        percentage: true,
        userTiming: false,
        pixelDepth: false
    });

    // scroll to "try now" section and log it to GA
    $("#try-now-link").click(function () {
        $('html, body').animate({
            scrollTop: $("#try-now").offset().top
        }, 750);
        ga('send', 'event', 'Website', 'Clicked', 'Try now');
    });

    // scroll to "how it works" section
    $("#how-it-works-link").click(function () {
        $('html, body').animate({
            scrollTop: $("#how-it-works").offset().top
        }, 750);
        ga('send', 'event', 'Website', 'Clicked', 'How it works');
    });

    // log click on the download button to GA
    $('#link-download-beta').click(function (e) {
        e.preventDefault();
        ga('send', 'event', 'Application', 'Downloaded', 'beta', {
            'hitCallback': function () {
                document.location = '/download/latest/';
            }
        });
        return false;
    });
});
$(document).ready(function () {
    // Submit subscription on submit
    $('#subscription-form').on('submit', function(event){
        event.preventDefault();
        console.log("form submitted!"); // sanity check
        $('#subcribe-btn .fa').removeClass('hidden'); // show spinner
        create_subscription();
    });
});



// AJAX for posting
function create_subscription() {
    console.log("create post is working!"); // sanity check
    console.log($('#id_subscription_email').val());
    $.ajax({
        url : "subscribe/", // the endpoint
        type : "POST", // http method
        data : { email : $('#id_subscription_email').val() }, // data sent with the post request

        // handle a successful response
        success : function(response) {
            $('#id_subscription_email').val(''); // remove the value from the input
            console.log(response); // log the returned json to the console
            console.log("success"); // another sanity check
            if (response.success) {
                showAlertTo('#subscription-alerts', 'alert-success', 'Success!', response.message);
            } else {
                if (response.message != null)
                    showAlertTo('#subscription-alerts', 'alert-danger text-left', 'Error!', response.message);
                else
                    showAlertTo('#subscription-alerts', 'alert-danger text-left', 'Error!', JSON.parse(response.errors).email);
            }
            $('#subcribe-btn').find('.fa').addClass('hidden'); // show spinner
        },

        // handle a non-successful response
        error : function(xhr, errmsg, err) {
            showAlertTo('#subscription-alerts', 'alert-danger text-left', 'Error!', 'An error occurred');
            $('#subcribe-btn').find('.fa').addClass('hidden'); // show spinner
            console.log(xhr.status + ": " + xhr.responseText); // provide a bit more info about the error to the console
        }
    });
}

function showAlertTo(target, classname, status, messages) {
    var messagesHtml = '';
    if ($.isArray(messages)) {
        messagesHtml += '<ul>';
        for (var i=0; i<messages.length; i++) {
            messagesHtml += '<li>' + messages[i].message + '</li>';
        }
        messagesHtml += '</ul>'
    } else {
        messagesHtml += messages;
    }

    $(target).html(
        '<div class="alert ' + classname + '">' +
        '<a href="#" class="close" data-dismiss="alert" aria-label="close" title="close">×</a>' +
        '<strong>' + status + ' </strong>' + messagesHtml + '</div>'
    );
}