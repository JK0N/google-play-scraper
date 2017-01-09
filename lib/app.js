var Promise = require('bluebird');
var request = require('request-promise');
var cheerio = require('cheerio');
var playStoreUrl = 'https://play.google.com/store/apps/details';
var queryString = require('querystring');
var url = require('url');

var h = require('./helpers');

function app(id, lang) {
  lang = lang || 'en';

  return new Promise(function(resolve, reject) {
    var reqUrl = url.parse(playStoreUrl + '?' + queryString.stringify({id: id, hl: lang}));
    request(reqUrl.href)
        .then(cheerio.load, h.requestError)
        .then(parseFields)
            .then(function(app) {
              app.url = reqUrl.href;
              app.appId = id;
              resolve(app);
            })
            .catch(reject);
  });
}

function parseFields($) {
  var detailsInfo = $('.details-info');
  var title = detailsInfo.find('div.document-title').text().trim();
  var developer = detailsInfo.find('span[itemprop="name"]').text();
  var summary = $('meta[name="description"]').attr('content');

  var genre = [];
  detailsInfo.find('span[itemprop="genre"]').each(function(i, elem) {
    genre[i] = $(this).text();
  });

  var parseText = function(elems) {

        if (!elems) return '';

        var ret = '',
            len = elems.length,
            elem;

        for (var i = 0; i < len; i++) {
          elem = elems[i];
          if (elem.type === 'text') ret = (ret || '').trim() + ' ' + (elem.data || '').trim() + ' ';
          else if (elem.children && elem.type !== 'comment') {
            ret = (ret || '').trim() + ' ' + parseText(elem.children).trim() + ' ';
          }
        }

        return ret.trim();
  };

  var price = detailsInfo.find('meta[itemprop=price]').attr('content');
  var icon = detailsInfo.find('img.cover-image').attr('src');
  var offersIAP = !!detailsInfo.find('.inapp-msg').length;
  var adSupported = !!detailsInfo.find('.ads-supported-label-msg').length;
  var additionalInfo = $('.details-section-contents');

  var description = additionalInfo.find('div[itemprop=description] div').filter(function(i, elem) {
    var style = $(elem).attr('style');
    return style !== 'display:none';
  });

  var developerEmail = null;

  $('a[class=dev-link]').each(function(i, elem) {
    var temp = $(elem).attr('href') || '';
    if (temp.indexOf('mailto:') === 0) {
      developerEmail = temp.replace('mailto:', '');
      return false;
    }
  });

  var developerWebsite = additionalInfo.find('.dev-link[href^="http"]').attr('href');
    if (developerWebsite) {
      // extract clean url wrapped in google url
      developerWebsite = url.parse(developerWebsite, true).query.q;
  }

  var version = additionalInfo.find('div.content[itemprop="softwareVersion"]').text().trim();
  var updated = additionalInfo.find('div.content[itemprop="datePublished"]').text().trim();
  var requiredAndroidVersion = additionalInfo.find('div.content[itemprop="operatingSystems"]').text().trim();
  var contentRating = additionalInfo.find('div.content[itemprop="contentRating"]').text().trim();
  var size = additionalInfo.find('div.content[itemprop="fileSize"]').text().trim();

  var installs = additionalInfo.find('div.content[itemprop="numDownloads"]').text().trim();
  var minInstalls = cleanInt(installs.split(' - ')[0]);
  var maxInstalls = cleanInt(installs.split(' - ')[1]) || undefined;
  var preregister = !!$('.preregistration-container').length;

  var comments = [];

  var $allComments = $('.single-review');

  $allComments.each(function() {
    var rating = $('.review-info-star-rating > div', $(this)).attr('aria-label');
    var comment = {
      author: $('.author-name', $(this)).text().trim(),
      date: $('.review-date', $(this)).text().trim(),
      rating: cleanInt(rating.match(/([12345]){1}/)[0]),
      comment: $('.review-body', $(this)).text().trim().replace('  Full Review', '').trim(),
    };
    comments.push(comment);
  });

  var ratingBox = $('.rating-box');
  var reviews = cleanInt(ratingBox.find('span.reviews-num').text());

  var ratingHistogram = $('.rating-histogram');
  var histogram = {
    5: cleanInt(ratingHistogram.find('.five .bar-number').text()),
    4: cleanInt(ratingHistogram.find('.four .bar-number').text()),
    3: cleanInt(ratingHistogram.find('.three .bar-number').text()),
    2: cleanInt(ratingHistogram.find('.two .bar-number').text()),
    1: cleanInt(ratingHistogram.find('.one .bar-number').text()),
  };

  var screenshots = $('.thumbnails').find('img.screenshot').map(function() {
    return $(this).attr('src');
  }).get();

  var recentChanges = $('.recent-change').toArray().map(function(elem) {
    return $(elem).text();
  });

  // for other languages
  var score = parseFloat(ratingBox.find('div.score').text().replace(',', '.')) || 0;

  var video = $('.screenshots span.preview-overlay-container[data-video-url]').attr('data-video-url');
  if (video) {
    video = video.split('?')[0];
  }

  return {
    title: title,
    icon: icon,
    screenshots: screenshots,
    minInstalls: minInstalls,
    maxInstalls: maxInstalls,
    score: score,
    reviews: reviews,
    histogram: histogram,
    offersIAP: offersIAP,
    adSupported: adSupported,
    preregister: preregister,
    summary: summary,
    description: parseText(description),
    descriptionHTML: description.html(),
    developer: developer,
    developerEmail: developerEmail,
    developerWebsite: developerWebsite,
    updated: updated,
    version: version,
    recentChanges: recentChanges,
    size: size,
    requiredAndroidVersion: requiredAndroidVersion,
    contentRating: contentRating,
    genre: genre,
    price: price,
    free: price === '0',
    video: video,
    comments: comments,
  };
}

function cleanInt(number) {
  number = number || '0';

  // removes thousands separator
  number = number.replace(/\D/g, '');
  return parseInt(number);
}

module.exports = app;
