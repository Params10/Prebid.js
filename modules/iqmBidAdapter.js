import {registerBidder} from '../src/adapters/bidderFactory.js';
import {config} from '../src/config.js';
import * as utils from '../src/utils.js';
import {BANNER, VIDEO} from '../src/mediaTypes.js';
const BIDDER_CODE = 'iqm';
const ENDPOINT_URL = 'https://frontend.stage.iqm.com/static/banner-response.json';
const VERSION = 'v.1.0.0';
// const VIDEO_PARAMS = [

//   'mimes',
//   'minduration',
//   'maxduration',
//   'placement',
//   'protocols',
//   'startdelay',
//   'skip',
//   'skipafter',
//   'minbitrate',
//   'maxbitrate',
//   'delivery',
//   'playbackmethod',
//   'api',
//   'linearity'
// ];
export const spec = {
  supportedMediaTypes: [BANNER, VIDEO],
  code: BIDDER_CODE,
  aliases: ['iqm'], // short code

  /**
   * Determines whether or not the given bid request is valid.
   *
   * @param {BidRequest} bid The bid params to validate.
   * @return boolean True if this is a valid bid, and false otherwise.
   */
  isBidRequestValid: function (bid) {
    // const vidMediaType = utils.deepAccess(bid, 'mediaTypes.video');
    // const context = utils.deepAccess(bid, 'mediaTypes.video.context');

    // if (bid.mediaType === 'VIDEO' || (vidMediaType && context !== 'outstream')) {
    //   const videoAdUnit = utils.deepAccess(bid, 'mediaTypes.video');
    //   const videoBidderParams = utils.deepAccess(bid, 'params.video', {});
    //   if (videoAdUnit === undefined) {
    //     return false;
    //   }
    //   if (!(bid && bid.params && bid.params.publisherId && bid.params.placementId && bid.params.tagId)) {
    //     return false;
    //   }

    //   if (!Array.isArray(videoAdUnit.playerSize)) {
    //     return false;
    //   }

    //   if (!videoAdUnit.context) {
    //     return false;
    //   }

    //   const videoParams = {
    //     ...videoAdUnit,
    //     ...videoBidderParams
    //   };

    //   if (!Array.isArray(videoParams.mimes) || videoParams.mimes.length === 0) {
    //     return false;
    //   }

    //   if (!Array.isArray(videoParams.protocols) || videoParams.protocols.length === 0) {
    //     return false;
    //   }

    //   // If placement if defined, it must be a number
    //   // if (
    //   //   typeof videoParams.placement !== 'undefined' &&
    //   //   typeof videoParams.placement !== 'number'
    //   // ) {
    //   //   return false;
    //   // }

    //   // If startdelay is defined it must be a number
    //   if (
    //     videoAdUnit.context === 'instream' &&
    //           typeof videoParams.startdelay !== 'undefined' &&
    //           typeof videoParams.startdelay !== 'number'
    //   ) {
    //     return false;
    //   }

    //   return true;
    // }
    const banner = utils.deepAccess(bid, 'mediaTypes.banner');
    // If there's no banner no need to validate against banner rules
    if (banner === undefined) {
      return false;
    }

    return !!(bid && bid.params && bid.params.publisherId && bid.params.placementId && bid.params.tagId);
  },

  buildRequests: function(validBidRequests, bidderRequest) {
    // const pageUrl = (bidderRequest && bidderRequest.refererInfo) ? (bidderRequest.refererInfo.referer) : (undefined);

    return validBidRequests.map(bidderRequest => createRequest(bidderRequest));
    // return validBidRequests.map(bid => {
    //   requestId = bid.requestId;
    //   let bidfloor = utils.getBidIdParameter('bidfloor', bid.params);
    //   siteId = utils.getBidIdParameter('siteId', bid.params);
    //   const imp = {
    //     id: bid.bidId,
    //     secure: 1,
    //     bidfloor: bidfloor || 0,
    //     displaymanager: 'Prebid.js',
    //     displaymanagerver: VERSION,
    //     mediatype: 'banner'
    //   };
    //   imp.banner = getSize(bid.sizes);
    //   let data = {
    //     id: requestId,
    //     publisherId: utils.getBidIdParameter('publisherId', bid.params),
    //     tagId: utils.getBidIdParameter('tagId', bid.params),
    //     placementId: utils.getBidIdParameter('placementId', bid.params),
    //     device: device,
    //     site: {
    //       id: siteId,
    //       page: utils.getTopWindowLocation().href,
    //       domain: utils.getTopWindowLocation().host
    //     },
    //     imp: imp
    //   };
    //   return {
    //     method: 'POST',
    //     url: ENDPOINT_URL,
    //     data: data
    //   };
    // });
  },

  /**
   * Unpack the response from the server into a list of bids.
   *
   * @param {*} serverResponse A successful response from the server.
   * @param bidRequest
   * @return {Bid[]} An array of bids which were nested inside the server.
   */
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
              requestId: bid.impid,
              currency: serverResponse.cur || 'USD',
              cpm: responseCPM,
              netRevenue: true,
              creativeId: bid.crid || '',
              ad: bid.adm || '',
              width: bid.w || bidRequest.data.imp.banner.w,
              height: bid.h || bidRequest.data.imp.banner.h,
              ttl: bid.ttl || config.getConfig('_bidderTimeout')
            };

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

// let requestId = '';
function createRequest (bidderRequest) {
  var finalRequest = {};

  finalRequest.imp = [{}];
  if (utils.deepAccess(bidderRequest, 'mediaTypes.banner')) {
    finalRequest = createBannerRTB(bidderRequest);
  }
  if (utils.deepAccess(bidderRequest, 'mediaTypes.banner')) {
    // finalRequest.imp[0].video = createVideoRTB(bidRequest);
  }
}

function createBannerRTB(bidderRequest) {
  const site = getSite(bidderRequest);
  let device = getDevice();

  let bidfloor = utils.getBidIdParameter('bidfloor', bidderRequest.params);
  ;

  const imp = {

    id: 1,
    secure: 1,
    bidfloor: bidfloor || 0,
    displaymanager: 'Prebid.js',
    displaymanagerver: VERSION,
    tagId: utils.getBidIdParameter('tagId', bidderRequest.params),
    mediatype: 'banner'
  };
  imp.banner = getSize(bidderRequest.sizes);
  let data = {
    id: bidRequest.bidId,
    publisherId: utils.getBidIdParameter('publisherId', bidderRequest.params),

    placementId: utils.getBidIdParameter('placementId', bidderRequest.params),
    device: device,
    site: site,
    imp: imp
  };

  return {
    method: 'POST',
    url: ENDPOINT_URL,
    data: data,
    bidderRequest

  };
}

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

registerBidder(spec);
