import { expect } from 'chai';

import * as utils from 'src/utils.js';
import { config } from 'src/config.js';
import { newBidder } from 'src/adapters/bidderFactory.js';
import * as bidderFactory from 'src/adapters/bidderFactory.js';
import { deepClone } from 'src/utils.js';
import { spec } from 'modules/iqmBidAdapter.js';

const ENDPOINT = 'https://frontend.stage.iqm.com/static/banner-response.json';

describe('iqmAdapter', function () {
  const adapter = newBidder(spec);

  describe('inherited functions', function () {
    it('exists and is a function', function () {
      expect(adapter.callBids).to.exist.and.to.be.a('function');
    });
  });

  describe('isBidRequestValid', function () {
    let bid =
        {
          bidder: 'iqm',
          params: {
            publisherId: 'df5fd732-c5f3-11e7-abc4-cec278b6b50a',
            tagId: '1c5c9ec2-c5f4-11e7-abc4-cec278b6b50a',
            placementId: '50cc36fe-c5f4-11e7-abc4-cec278b6b50a',
            bidfloor: 0.50
          },

          'adUnitCode': 'adunit-code',
          'sizes': [[250, 250], [640, 480]],
          'bidId': '30b31c1838de1e',
          'bidderRequestId': '22edbae2733bf6',
          'auctionId': '1d1a030790a475',
        };

    it('should return true when required params found', function () {
      expect(spec.isBidRequestValid(bid)).to.equal(true);
    });

    it('should return false when required params are not found', function () {
      let bid = Object.assign({}, bid);
      delete bid.params;
      bid.params = {
        // placementId: iosDevice ? 13239390 : 13232361, // Add your own placement id here. Note, skippable video is not supported on iOS
        placementId: 0,

      };
      expect(spec.isBidRequestValid(bid)).to.equal(false);
    });
  });

  describe('buildRequests', function () {
    let bidRequests = [
      {
        'bidder': 'iqm',
        'params': {
          'placementId': '50cc36fe-c5f4-11e7-abc4-cec278b6b50a'
        },
        'adUnitCode': 'adunit-code',
        'sizes': [[300, 250], [300, 600]],
        'bidId': '30b31c1838de1e',
        'bidderRequestId': '22edbae2733bf6',
        'auctionId': '1d1a030790a475',

      }
    ];

    it('should parse out  sizes', function () {
      let bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placementId: '50cc36fe-c5f4-11e7-abc4-cec278b6b50a',
            sizes: [250, 250]
          }
        }
      );
      const request = spec.buildRequests([bidRequest]);
      const payload = request.data;
      print(payload);
      expect(payload.device).to.exist;
      expect(payload.sizes).to.deep.equal([{w: 250, h: 250}]);
    });
    it('should add source and verison to the tag', function () {
      const request = spec.buildRequests([bidRequest]);
      const payload = request.data;
      expect(payload.sdk).to.exist;
      expect(payload.sdk).to.deep.equal({
        source: 'pbjs',
        version: '$prebid.version$'
      });
    });
    it('should populate the ad_types array on all requests', function () {
      ['banner', 'video'].forEach(type => {
        const bidRequest = Object.assign({}, bidRequests[0]);
        bidRequest.mediaTypes = {};
        bidRequest.mediaTypes[type] = {};

        const request = spec.buildRequests([bidRequest]);
        const payload = request.data;

        expect(payload.mediaTypes).to.deep.equal([type]);
      });
    });
    //   it('sends bid request to ENDPOINT via POS', function () {
    //     const request = spec.buildRequests(bidRequests);
    //     expect(request.url).to.equal(ENDPOINT);
    //    // expect(request.method).to.equal('POST');
    //   });
    it('should attach valid video params to the tag', function () {
      let bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            // placementId: iosDevice ? 13239390 : 13232361, // Add your own placement id here. Note, skippable video is not supported on iOS
            publisherId: 'df5fd732-c5f3-11e7-abc4-cec278b6b50a',
            tagId: '1c5c9ec2-c5f4-11e7-abc4-cec278b6b50a',
            placementId: '50cc36fe-c5f4-11e7-abc4-cec278b6b50a',
            bidfloor: 0.50,

            video: {
              placement: 2,
              mimes: ['video/mp4'],
              protocols: [2, 5],
              skipppable: true,
              playback_method: ['auto_play_sound_off']
            }
          }
        });

      const request = spec.buildRequests([bidRequest]);
      const payload = request.data;
      expect(payload.imp.video).to.deep.equal({
        placement: 2,
        mimes: ['video/mp4'],
        protocols: [2, 5]
      });
    });

    it('should convert keyword params to proper form and attaches to request', function () {
      let bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placementId: '10433394',
            keywords: {
              single: 'val',
              singleArr: ['val'],
              singleArrNum: [5],
              multiValMixed: ['value1', 2, 'value3'],
              singleValNum: 123,
              emptyStr: '',
              emptyArr: [''],
              badValue: {'foo': 'bar'} // should be dropped
            }
          }
        }
      );

      const request = spec.buildRequests([bidRequest]);
      const payload = request.data;

      expect(payload.keywords).to.deep.equal([{
        'key': 'single',
        'value': ['val']
      }, {
        'key': 'singleArr',
        'value': ['val']
      }, {
        'key': 'singleArrNum',
        'value': ['5']
      }, {
        'key': 'multiValMixed',
        'value': ['value1', '2', 'value3']
      }, {
        'key': 'singleValNum',
        'value': ['123']
      }, {
        'key': 'emptyStr'
      }, {
        'key': 'emptyArr'
      }]);
    });

    it('should add referer info to payload', function () {
      const bidRequest = Object.assign({}, bidRequests[0])
      const bidderRequest = {
        refererInfo: {
          referer: 'http://example.com/page.html',
          reachedTop: true,
          numIframes: 2,
          stack: [
            'http://example.com/page.html',
            'http://example.com/iframe1.html',
            'http://example.com/iframe2.html'
          ]
        }
      }
      const request = spec.buildRequests([bidRequest], bidderRequest);
      const payload = request.data;

      expect(payload.referrer_detection).to.exist;
      expect(payload.referrer_detection).to.deep.equal({
        rd_ref: 'http%3A%2F%2Fexample.com%2Fpage.html',
        rd_top: true,
        rd_ifs: 2,
        rd_stk: bidderRequest.refererInfo.stack.map((url) => encodeURIComponent(url)).join(',')
      });
    });
  })

  // describe('interpretResponse', function () {
  //   let bfStub;
  //   before(function() {
  //     bfStub = sinon.stub(bidderFactory, 'getIabSubCategory');
  //   });

  //   after(function() {
  //     bfStub.restore();
  //   });

  //   let response = {
  //     'version': '3.0.0',
  //   //  'tags': [
  //       // {
  //       //   'uuid': '3db3773286ee59',
  //       //   'tag_id': 10433394,
  //       //   'auction_id': '4534722592064951574',
  //       //   'nobid': false,
  //       //   'no_ad_url': 'http://lax1-ib.adnxs.com/no-ad',
  //       //   'timeout_ms': 10000,
  //       //   'ad_profile_id': 27079,
  //       //   'ads': [
  //       //     {
  //       //       'content_source': 'rtb',
  //       //       'ad_type': 'banner',
  //       //       'buyer_member_id': 958,
  //       //       'creative_id': 29681110,
  //       //       'media_type_id': 1,
  //       //       'media_subtype_id': 1,
  //       //       'cpm': 0.5,
  //       //       'cpm_publisher_currency': 0.5,
  //       //       'publisher_currency_code': '$',
  //       //       'client_initiated_ad_counting': true,
  //       //       'viewability': {
  //       //         'config': '<script type=\'text/javascript\' async=\'true\' src=\'http://cdn.adnxs.com/v/s/152/trk.js#v;vk=appnexus.com-omid;tv=native1-18h;dom_id=%native_dom_id%;st=0;d=1x1;vc=iab;vid_ccr=1;tag_id=13232354;cb=http%3A%2F%2Fams1-ib.adnxs.com%2Fvevent%3Freferrer%3Dhttp%253A%252F%252Ftestpages-pmahe.tp.adnxs.net%252F01_basic_single%26e%3DwqT_3QLNB6DNAwAAAwDWAAUBCLfl_-MFEMStk8u3lPTjRxih88aF0fq_2QsqNgkAAAECCCRAEQEHEAAAJEAZEQkAIREJACkRCQAxEQmoMOLRpwY47UhA7UhIAlCDy74uWJzxW2AAaM26dXjzjwWAAQGKAQNVU0SSAQEG8FCYAQGgAQGoAQGwAQC4AQHAAQTIAQLQAQDYAQDgAQDwAQCKAjt1ZignYScsIDI1Mjk4ODUsIDE1NTE4ODkwNzkpO3VmKCdyJywgOTc0OTQ0MDM2HgDwjZIC8QEha0RXaXBnajgtTHdLRUlQTHZpNFlBQ0NjOFZzd0FEZ0FRQVJJN1VoUTR0R25CbGdBWU1rR2FBQndMSGlrTDRBQlVvZ0JwQy1RQVFHWUFRR2dBUUdvQVFPd0FRQzVBZk90YXFRQUFDUkF3UUh6cldxa0FBQWtRTWtCbWo4dDA1ZU84VF9aQVFBQUEBAyRQQV80QUVBOVFFAQ4sQW1BSUFvQUlBdFFJBRAAdg0IeHdBSUF5QUlBNEFJQTZBSUEtQUlBZ0FNQm1BTUJxQVAFzIh1Z01KUVUxVE1UbzBNekl3NEFPVENBLi6aAmEhUXcxdGNRagUoEfQkblBGYklBUW9BRAl8AEEBqAREbzJEABRRSk1JU1EBGwRBQQGsAFURDAxBQUFXHQzwWNgCAOACrZhI6gIzaHR0cDovL3Rlc3RwYWdlcy1wbWFoZS50cC5hZG54cy5uZXQvMDFfYmFzaWNfc2luZ2xl8gITCg9DVVNUT01fTU9ERUxfSUQSAPICGgoWMhYAPExFQUZfTkFNRRIA8gIeCho2HQAIQVNUAT7wnElGSUVEEgCAAwCIAwGQAwCYAxegAwGqAwDAA-CoAcgDANgD8ao-4AMA6AMA-AMBgAQAkgQNL3V0L3YzL3ByZWJpZJgEAKIECjEwLjIuMTIuMzioBIqpB7IEDggAEAEYACAAKAAwADgCuAQAwAQAyAQA0gQOOTMyNSNBTVMxOjQzMjDaBAIIAeAEAfAEg8u-LogFAZgFAKAF______8BAxgBwAUAyQUABQEU8D_SBQkJBQt8AAAA2AUB4AUB8AWZ9CH6BQQIABAAkAYBmAYAuAYAwQYBITAAAPA_yAYA2gYWChAAOgEAGBAAGADgBgw.%26s%3D971dce9d49b6bee447c8a58774fb30b40fe98171;ts=1551889079;cet=0;cecb=\'></script>'
  //       //       },
  //       //       'rtb': {
  //       //         'banner': {
  //       //           'content': '<!-- Creative -->',
  //       //           'width': 300,
  //       //           'height': 250
  //       //         },
  //       //         'trackers': [
  //       //           {
  //       //             'impression_urls': [
  //       //               'http://lax1-ib.adnxs.com/impression'
  //       //             ],
  //       //             'video_events': {}
  //       //           }
  //       //         ]
  //       //       }
  //       //     }
  //       //   ]
  //       // }
  // //    ]
  //   };

  //   it('should get correct bid response', function () {
  //     // let expectedResponse = [
  //     //   {
  //     //     'requestId': '3db3773286ee59',
  //     //     'cpm': 0.5,
  //     //     'creativeId': 29681110,

  //     //     'width': 250,
  //     //     'height': 250,
  //     //     'ad': '<!-- Creative -->',
  //     //     'mediaType': 'banner',
  //     //     'currency': 'USD',
  //     //     'ttl': 300,
  //     //     'netRevenue': true,
  //     //     'adUnitCode': 'code',
  //     //     'ads4good': {
  //     //       'buyerMemberId': 958
  //     //     }
  //     //   }
  //     // ];
  //     let bidderRequest = {
  //       bids: [{
  //         bidId: '3db3773286ee59',
  //         adUnitCode: 'code'
  //       }]
  //     }
  //     let result = spec.interpretResponse({ body: response }, {bidderRequest});
  //     expect(Object.keys(result[0])).to.have.members(Object.keys(expectedResponse[0]));
  //   });

  //   it('handles nobid responses', function () {
  //     let response = {
  //       'version': '0.0.1',
  //       'tags': [{
  //         'uuid': '84ab500420319d',
  //         'tag_id': 5976557,
  //         'auction_id': '297492697822162468',
  //         'nobid': true
  //       }]
  //     };
  //     let bidderRequest;

  //     let result = spec.interpretResponse({ body: response }, {bidderRequest});
  //     expect(result.length).to.equal(0);
  //   });

  //   it('handles non-banner media responses', function () {
  //     let response = {
  //       'tags': [{
  //         'uuid': '84ab500420319d',
  //         'ads': [{
  //           'ad_type': 'video',
  //           'cpm': 0.500000,
  //           'notify_url': 'imptracker.com',
  //           'rtb': {
  //             'video': {
  //               'content': '<!-- Creative -->'
  //             }
  //           },
  //           'javascriptTrackers': '<script type=\'text/javascript\' async=\'true\' src=\'http://cdn.adnxs.com/v/s/152/trk.js#v;vk=appnexus.com-omid;tv=native1-18h;dom_id=%native_dom_id%;st=0;d=1x1;vc=iab;vid_ccr=1;tag_id=13232354;cb=http%3A%2F%2Fams1-ib.adnxs.com%2Fvevent%3Freferrer%3Dhttp%253A%252F%252Ftestpages-pmahe.tp.adnxs.net%252F01_basic_single%26e%3DwqT_3QLNB6DNAwAAAwDWAAUBCLfl_-MFEMStk8u3lPTjRxih88aF0fq_2QsqNgkAAAECCCRAEQEHEAAAJEAZEQkAIREJACkRCQAxEQmoMOLRpwY47UhA7UhIAlCDy74uWJzxW2AAaM26dXjzjwWAAQGKAQNVU0SSAQEG8FCYAQGgAQGoAQGwAQC4AQHAAQTIAQLQAQDYAQDgAQDwAQCKAjt1ZignYScsIDI1Mjk4ODUsIDE1NTE4ODkwNzkpO3VmKCdyJywgOTc0OTQ0MDM2HgDwjZIC8QEha0RXaXBnajgtTHdLRUlQTHZpNFlBQ0NjOFZzd0FEZ0FRQVJJN1VoUTR0R25CbGdBWU1rR2FBQndMSGlrTDRBQlVvZ0JwQy1RQVFHWUFRR2dBUUdvQVFPd0FRQzVBZk90YXFRQUFDUkF3UUh6cldxa0FBQWtRTWtCbWo4dDA1ZU84VF9aQVFBQUEBAyRQQV80QUVBOVFFAQ4sQW1BSUFvQUlBdFFJBRAAdg0IeHdBSUF5QUlBNEFJQTZBSUEtQUlBZ0FNQm1BTUJxQVAFzIh1Z01KUVUxVE1UbzBNekl3NEFPVENBLi6aAmEhUXcxdGNRagUoEfQkblBGYklBUW9BRAl8AEEBqAREbzJEABRRSk1JU1EBGwRBQQGsAFURDAxBQUFXHQzwWNgCAOACrZhI6gIzaHR0cDovL3Rlc3RwYWdlcy1wbWFoZS50cC5hZG54cy5uZXQvMDFfYmFzaWNfc2luZ2xl8gITCg9DVVNUT01fTU9ERUxfSUQSAPICGgoWMhYAPExFQUZfTkFNRRIA8gIeCho2HQAIQVNUAT7wnElGSUVEEgCAAwCIAwGQAwCYAxegAwGqAwDAA-CoAcgDANgD8ao-4AMA6AMA-AMBgAQAkgQNL3V0L3YzL3ByZWJpZJgEAKIECjEwLjIuMTIuMzioBIqpB7IEDggAEAEYACAAKAAwADgCuAQAwAQAyAQA0gQOOTMyNSNBTVMxOjQzMjDaBAIIAeAEAfAEg8u-LogFAZgFAKAF______8BAxgBwAUAyQUABQEU8D_SBQkJBQt8AAAA2AUB4AUB8AWZ9CH6BQQIABAAkAYBmAYAuAYAwQYBITAAAPA_yAYA2gYWChAAOgEAGBAAGADgBgw.%26s%3D971dce9d49b6bee447c8a58774fb30b40fe98171;ts=1551889079;cet=0;cecb=\'></script>'
  //         }]
  //       }]
  //     };
  //     let bidderRequest = {
  //       bids: [{
  //         bidId: '84ab500420319d',
  //         adUnitCode: 'code'
  //       }]
  //     }

  //     let result = spec.interpretResponse({ body: response }, {bidderRequest});
  //     expect(result[0]).to.have.property('vastUrl');
  //     expect(result[0]).to.have.property('vastImpUrl');
  //     expect(result[0]).to.have.property('mediaType', 'video');
  //   });

  //   it('should add deal_priority and deal_code', function() {
  //     let responseWithDeal = deepClone(response);
  //     responseWithDeal.tags[0].ads[0].deal_priority = 'high';
  //     responseWithDeal.tags[0].ads[0].deal_code = '123';

  //     let bidderRequest = {
  //       bids: [{
  //         bidId: '3db3773286ee59',
  //         adUnitCode: 'code'
  //       }]
  //     }
  //     let result = spec.interpretResponse({ body: responseWithDeal }, {bidderRequest});
  //     expect(Object.keys(result[0].ads4good)).to.include.members(['buyerMemberId', 'dealPriority', 'dealCode']);
  //   });

  //   it('should add advertiser id', function() {
  //     let responseAdvertiserId = deepClone(response);
  //     responseAdvertiserId.tags[0].ads[0].advertiser_id = '123';

  //     let bidderRequest = {
  //       bids: [{
  //         bidId: '3db3773286ee59',
  //         adUnitCode: 'code'
  //       }]
  //     }
  //     let result = spec.interpretResponse({ body: responseAdvertiserId }, {bidderRequest});
  //     expect(Object.keys(result[0].meta)).to.include.members(['advertiserId']);
  //   })
  // });
});
