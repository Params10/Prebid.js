import {registerBidder} from '../src/adapters/bidderFactory.js';
import {config} from '../src/config.js';
import * as utils from '../src/utils.js';
import {BANNER, VIDEO} from '../src/mediaTypes.js';
import {Renderer} from '../src/Renderer.js';
const BIDDER_CODE = 'iqm';
var ENDPOINT_URL = 'https://frontend.stage.iqm.com/static/banner-response.json';
const VERSION = 'v.1.0.0';

const VIDEO_ORTB_PARAMS = [
  'mimes',
  'minduration',
  'maxduration',
  'placement',
  'protocols',
  'startdelay',
  'skip',
  'skipafter',
  'minbitrate',
  'maxbitrate',
  'delivery',
  'playbackmethod',
  'api',
  'linearity'
];
const PRODUCT = {
  SIAB: 'siab',
  INVIEW: 'inview',
  INSTREAM: 'instream'
};

export const spec = {

  supportedMediaTypes: [BANNER, VIDEO],
  code: BIDDER_CODE,
  aliases: ['iqm'],

  /**
   * Determines whether or not the given bid request is valid.
   *
   * @param {BidRequest} bid The bid params to validate.
   * @return boolean True if this is a valid bid, and false otherwise.
   */

  isBidRequestValid: function (bid) {
    const banner = utils.deepAccess(bid, 'mediaTypes.banner');
    // If there's no banner no need to validate against banner rules
    const videoMediaType = utils.deepAccess(bid, 'mediaTypes.video');
    const context = utils.deepAccess(bid, 'mediaTypes.video.context');

    if (bid.mediaType === 'video' || (videoMediaType && context !== 'outstream')) {
      const videoBidderParams = utils.deepAccess(bid, 'params.video', {});

      // If there's no video no need to validate against video rules

      if (!Array.isArray(videoMediaType.playerSize)) {
        return false;
      }

      if (!videoMediaType.context) {
        return false;
      }

      const videoParams = {
        ...videoMediaType,
        ...videoBidderParams
      };

      if (!Array.isArray(videoParams.mimes) || videoParams.mimes.length === 0) {
        return false;
      }

      if (!Array.isArray(videoParams.protocols) || videoParams.protocols.length === 0) {
        return false;
      }

      // If placement if defined, it must be a number
      if (
        typeof videoParams.placement !== 'undefined' &&
        typeof videoParams.placement !== 'number'
      ) {
        return false;
      }

      // If startdelay is defined it must be a number
      if (
        videoMediaType.context === 'instream' &&
        typeof videoParams.startdelay !== 'undefined' &&
        typeof videoParams.startdelay !== 'number'
      ) {
        return false;
      }

      return !!(bid && bid.params && bid.params.publisherId && bid.params.placementId && bid.params.tagId);
    } else {
      if (banner === 'undefined') {
        return false;
      }
      return !!(bid && bid.params && bid.params.publisherId && bid.params.placementId && bid.params.tagId);
    }
  },

  buildRequests: function(validBidRequests, bidderRequest) {
    return validBidRequests.map(bid => {
      var finalRequest = {};
      let bidfloor = utils.getBidIdParameter('bidfloor', bid.params);

      const imp = {
        secure: 1,
        bidfloor: bidfloor || 0,
        displaymanager: 'Prebid.js',
        displaymanagerver: VERSION,
        tagId: utils.getBidIdParameter('tagId', bid.params),

      }
      if (utils.deepAccess(bid, 'mediaTypes.banner')) {
        imp.banner = getSize(bid.sizes);
        imp.mediatype = 'banner';
      } else if (utils.deepAccess(bid, 'mediaTypes.video')) {
        imp.video = _buildVideoORTB(bid);
        imp.mediatype = 'video';
        ENDPOINT_URL = 'https://frontend.stage.iqm.com/static/video-response.json';
      }
      const site = getSite(bid);
      let device = getDevice();

      finalRequest = {

        id: bid.bidId,
        publisherId: utils.getBidIdParameter('publisherId', bid.params),
        placementId: utils.getBidIdParameter('placementId', bid.params),
        device: device,
        site: site,
        imp: imp,
        auctionId: bid.auctionId,
        adUnitCode: bid.adUnitCode,
        bidRequestsCount: bid.bidRequestsCount,
        bidderRequestId: bid.bidderRequestId,
        transactionId: bid.transactionId,
        hb_pb_iqm: 0.50,
        hb_bidder_iqm: 'iqm',
        hb_adid_iqm: 'bid-5bdbab92aae961cfbdf7465d-5bdbab92aae961cfbdf74653',
        hb_size_iqm: '250x250',
        hb_source_iqm: 'client',
        hb_format_iqm: 'banner',
        uuid: bid.bidId,
        bidderRequest

      }

      const request = {
        method: 'GET',
        url: ENDPOINT_URL,
        data: finalRequest,
        header: {'Access-Control-Allow-Origin': '*'}

      }
      return request;
    });
  },

  interpretResponse: function(serverResponse, bidRequest) {
    // const serverBody = serverResponse.body;
    // const headerValue = serverResponse.headers.get('some-response-header')
    const bidResponses = [];
    serverResponse = serverResponse.body;
    if (serverResponse && utils.isArray(serverResponse.seatbid)) {
      utils._each(serverResponse.seatbid, function(bidList) {
        utils._each(bidList.bid, function(bid) {
          const responseCPM = parseFloat(bid.price);
          if (responseCPM > 0.0 && bid.impid) {
            // const responseNurl = bid.nurl || '';
            const bidResponse = {
              requestId: bidRequest.data.id,
              currency: serverResponse.cur || 'USD',
              cpm: responseCPM,
              netRevenue: true,
              creativeId: bid.crid || '',

              adUnitCode: bidRequest.data.adUnitCode,
              auctionId: bidRequest.data.auctionId,
              mediaType: bidRequest.data.imp.mediatype,

              ttl: bid.ttl || config.getConfig('_bidderTimeout')
            };
            if (bidRequest.data.imp.mediatype === 'video') {
              bidResponse.width = bid.w || bidRequest.data.imp.video.w;
              bidResponse.height = bid.h || bidRequest.data.imp.video.h;

              // bidResponse.vastXml = bid.adm;
              if (bidRequest.data.imp.video.context === 'instream') {
                bidResponse.vastUrl = bid.nurl;
              } else if (bidRequest.data.imp.video.context === 'outstream') {
                bidResponse.vastXml = bid.adm;
                bidResponse.vastUrl = bid.nurl;
                bidRequest.vastUrl = bid.nurl;
              
              }
            } else {
              bidResponse.ad = bid.adm;
              bidResponse.width = bid.w || bidRequest.data.imp.banner.w;
              bidResponse.height = bid.h || bidRequest.data.imp.banner.h;
            }
            bidResponses.push(bidResponse);
          }
        })
      });
    }
    return bidResponses;
  },

  onBidWon: function (bid) {
    if (!bid['nurl']) { return; }
    utils.triggerPixel(bid['nurl']);
  }

};

let getDevice = function () {
  const language = navigator.language ? 'language' : 'userLanguage';
  return {
    h: screen.height,
    w: screen.width,
    dnt: _getDNT() ? 1 : 0,
    language: navigator[language].split('-')[0],
    make: navigator.vendor ? navigator.vendor : '',
    ua: navigator.userAgent,
    devicetype: _isMobile() ? 1 : _isConnectedTV() ? 3 : 2
  };
};

let _getDNT = function () {
  return navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1' || navigator.doNotTrack === 'yes';
};

let getSize = function (sizes) {
  let sizeMap;
  if (sizes.length === 2 && typeof sizes[0] === 'number' && typeof sizes[1] === 'number') {
    sizeMap = {w: sizes[0], h: sizes[1]};
  } else {
    sizeMap = {w: sizes[0][0], h: sizes[0][1]};
  }
  return sizeMap;
};

function _isMobile() {
  return (/(ios|ipod|ipad|iphone|android)/i).test(global.navigator.userAgent);
}

function _isConnectedTV() {
  return (/(smart[-]?tv|hbbtv|appletv|googletv|hdmi|netcast\.tv|viera|nettv|roku|\bdtv\b|sonydtv|inettvbrowser|\btv\b)/i).test(global.navigator.userAgent);
}
function getSite(bidderRequest) {
  let domain = '';
  let page = '';
  let referrer = '';
  const Id = 1;

  const { refererInfo } = bidderRequest;

  if (canAccessTopWindow()) {
    const wt = utils.getWindowTop();
    domain = wt.location.hostname;
    page = wt.location.href;
    referrer = wt.document.referrer || '';
  } else if (refererInfo.reachedTop) {
    const url = utils.parseUrl(refererInfo.referer);
    domain = url.hostname;
    page = refererInfo.referer;
  } else if (refererInfo.stack && refererInfo.stack.length && refererInfo.stack[0]) {
    // important note check if refererInfo.stack[0] is 'thruly' because a `null` value
    // will be considered as "localhost" by the parseUrl function.
    // As the isBidRequestValid returns false when it does not reach the referer
    // this should never called.
    const url = utils.parseUrl(refererInfo.stack[0]);
    domain = url.hostname;
  }

  return {
    domain,
    page,
    Id,
    referrer
  };
};
function canAccessTopWindow() {
  try {
    if (utils.getWindowTop().location.href) {
      return true;
    }
  } catch (error) {
    return false;
  }
}

function _getProduct(bidRequest) {
  const { params, mediaTypes } = bidRequest;

  const { banner, video } = mediaTypes;

  if ((video && !banner) && video.context === 'instream') {
    return PRODUCT.INSTREAM;
  }

  return (params.productId === PRODUCT.INVIEW) ? (params.productId) : PRODUCT.SIAB;
}

function _buildVideoORTB(bidRequest) {
  const videoAdUnit = utils.deepAccess(bidRequest, 'mediaTypes.video');
  const videoBidderParams = utils.deepAccess(bidRequest, 'params.video', {});
  const video = {}

  const videoParams = {
    ...videoAdUnit,
    ...videoBidderParams // Bidder Specific overrides
  };
  video.context = 1;
  const {w, h} = getSize(videoParams.playerSize[0]);
  video.w = w;
  video.h = h;

  VIDEO_ORTB_PARAMS.forEach((param) => {
    if (videoParams.hasOwnProperty(param)) {
      video[param] = videoParams[param];
    }
  });
  const product = _getProduct(bidRequest);
  // if (typeof bidRequest.getFloor === 'function') {
  //   const bidfloors = _getBidFloors(bidRequest, {w: video.w, h: video.h}, VIDEO);
  // }

  video.placement = video.placement || 2;

  if (product === PRODUCT.INSTREAM) {
    video.startdelay = video.startdelay || 0;
    video.placement = 1;
    video.context = 'instream';
  } else {
    video.context = 'outstream';
  };

  // const imp = {
  //   secure: 1,
  //   bidfloor: bidfloor || 0,
  //   displaymanager: 'Prebid.js',
  //   displaymanagerver: VERSION,
  //   tagId: utils.getBidIdParameter('tagId', bid.params),
  //   mediatype: 'video',
  //   video: video,
  // }
  return video;
}

function createRenderer(bidResponse) {
  const renderer = Renderer.install({
    id: bidResponse.requestId,
    url: 'https://s2.adform.net/banners/scripts/video/outstream/render.js',
    loaded: false
  });

  renderer.setRender(bid => {
    bid.renderer.push(() => {
      window.Beachfront.Player(bid.adUnitCode, {
        adTagUrl: bid.vastUrl,
        width: bid.data.imp.w,
        height: bid.data.imp.h,
        // expandInView: getPlayerBidParam(bidRequest, 'expandInView', false),
        // collapseOnComplete: getPlayerBidParam(bidRequest, 'collapseOnComplete', true),
        // progressColor: getPlayerBidParam(bidRequest, 'progressColor'),
        // adPosterColor: getPlayerBidParam(bidRequest, 'adPosterColor')
      });
    });
  });

  return renderer;
}

registerBidder(spec);
