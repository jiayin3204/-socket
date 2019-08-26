// pages/video/video.js
var app = getApp();
import * as Event from '../../utils/eventConfig.js'
import {
  getBookResourceByType,
  getBookResourceDetail,
  getBookSourceDetail,
  preBuy,
  getChatList,
  setChat
} from '../../utils/book.js'
import {
  formatTime,
  dateFormat
} from '../../utils/util.js'

Page({

  /**
   * 页面的初始数据
   */
  data: {
    islive: true,
    detail: {
      state: 1
    },
    detailList: {
      state: 1
    },
    resource_id: '',
    book_id: '',
    content: '',
    chatList: '',
    is_pre_buy: '',
    bookDetail: '',
    scrollTop: '',
    isFullScreen: false,
    isShowFullScreeBtn: true,
    isShowMore: false,
    isOpen: false,
    statusMsg: '已断开',
    input_value_content: '',
    UserChatList: [],  
    fixed: true,
    isUser: false,
    start_time: true,
    send: false, // 输入框有字时判断是会否变色
    loading: false, // loading图
    is_connect: true,  // 连接标识
    is_ios: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取系统信息
    wx.getSystemInfo({
      success: res => {
        this.setData({
          scroll_height: res.system.split(' ')[0] === 'iOS' ? 2 * (res.windowHeight - 360) + 'rpx' : 2*(res.windowHeight - 261)+'rpx',
          is_ios: res.system.split(' ')[0] === 'iOS'
        })
      }
    })
    var that = this;
    app.checkLogin().then(_ => {
      that.handleQueryBookResourseDetail(options)
    })

    wx.setKeepScreenOn({
      keepScreenOn: true
    })
    this.setData({
      resource_id: options.resource_id,
      book_id: options.book_id,
      is_content_chat: true,
      isShowMore: false,
      input_value_content: '',
      UserChatList: [],
      fixed: true,
      isUser: false,
      isOpen: false
    })

    this.data.resource_id = options.resource_id;

    this.wssInit()
    var that = this;
    if (app.globalData.socketConnectFail) { // WebSocket断线重连
      setInterval(() => {
        that.handleGetChatList();
      }, 1000)
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    Event.release();
    app.globalData.noLoading = true;
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    wx.closeSocket()
  },

  hanldeNetWorkState(options) {
    let that = this;
    if (wx.getNetworkType) {
      wx.getNetworkType({
        success: function (res) {
          // 返回网络类型, 有效值：
          // wifi/2g/3g/4g/unknown(Android下不常见的网络类型)/none(无网络)
          var networkType = res.networkType
          // 检测是2g/3g/4g的情况
          if (networkType === '2g' || networkType === '3g' || networkType === '4g') {
            wx.showModal({
              title: '提示',
              content: !options.need_new_page ? '您当前的网络环境为' + networkType + ', 是否继续播放?' : '您当前的网络环境为' + networkType + ', 是否继续打开?',
              success: function (res) {
                if (res.confirm) {
                  // 用户点击确定则去拉取资源
                  if (options.book_id) {
                    that.handleQueryBookResourseDetail(options)
                  }
                } else if (res.cancel) {
                  // 用户点击取消则跳回到之前页
                  wx.navigateBack();
                }
              }
            })
          } else {
            // wifi情况下自动播放
            if (options.book_id) {
              that.handleQueryBookResourseDetail(options)
            }
          }
        }
      })
    }
  },

  // 获取图书资源详情
  handleQueryBookResourseDetail(payload) {
    var that = this;
    getBookResourceDetail({
      book_id: payload.book_id,
      resource_id: payload.resource_id
    }).then(data => {
      var start_time = new Date(data.start_time);
      var now_time = new Date();
      var time = parseInt(start_time - now_time);
      if (time < 0) {
        this.setData({
          start_time: false
        })
      }
      data.start_time = parseInt(time / 86400 / 1000) + '天' + parseInt(time / 3600 / 1000 % 24) + '时' + parseInt(time / 60 / 1000 % 60) + '分';
      this.setData({
        detail: data,
        islive: data.res_type_id == 20 ? true : false,
        is_pre_buy: data.is_pre_buy ? data.is_pre_buy : 0
      })
    }).catch(error => {
      Event.initShowToast(error, this);
    })
  },
  //显示播放控制条
  //TODO:live-player 点击事件不触发，暂时不实现
  showLiveControls() {
    return;
    this.setData({
      isShowFullScreeBtn: true
    });
    let that = this;
    setTimeout(function () {
      that.setData({
        isShowFullScreeBtn: false
      });
    }, 3000);
  },
  //全屏状态切换事件
  fullscreenchange(e) {
    this.setData({
      isFullScreen: e.detail.fullScreen,
    })
  },
  // 获取播放全屏按钮
  handFullscreen() {
    let livePlayer = wx.createLivePlayerContext('livePlayer');
    if (this.data.isFullScreen) {

      // 退出全屏状态
      livePlayer.exitFullScreen();
    } else {

      // 进入全屏状态
      livePlayer.requestFullScreen({ direction: 90 });
    }

  },

  // 我要预约
  formSubmit(event) {
    let formid = event.detail.formId
    preBuy({
      book_id: this.data.detail.book_id,
      book_title: this.data.detail.book_title,
      resource_id: this.data.resource_id,
      form_id: formid
    }).then((res) => {
      wx.showToast({
        title: '预约成功',
        icon: 'success',
        duration: 1000
      })
      this.setData({
        is_pre_buy: 1
      })
    })
  },
  // 获取播放聊天列表
  handleGetChatList() {
    getChatList({
      token: wx.getStorageSync('token'),
      resource_id: this.data.resource_id,
      book_id: this.data.book_id
    }).then(res => {
      if (res.data.length > 9) {
        this.setData({
          isShowMore: true,
          chatList: res,
          isOpen: false,
        })
      } else {
        this.setData({
          chatList: res,
          isShowMore: false,
          isOpen: false,
        })
      }
      this.setData({
        scrollTop: 10000
      })
    }).catch(err => {
      Event.initShowToast(err, this);
    })
  },
  // // 获取输入框value
  bindContent(e) {
    this.setData({
      content: e.detail.value,
      send: true
    })
    if (e.detail.value == '') {
      this.setData({
        content: e.detail.value,
        send: false
      })
    }
  },

  // // 下拉获取更多聊天记录
  getMoreChatList() {
    if (this.data.chatList.min_id == 0) {
      wx.showToast({
        title: '没有更多记录了哦',
        icon: 'none',
        duration: 1000
      })
      return;
    }
    this.setData({
      loading: true
    })
    getChatList({
      token: wx.getStorageSync('token'),
      resource_id: this.data.resource_id,
      book_id: this.data.book_id,
      page_index: 0,
      page_size: 10,
      start_id: this.data.chatList.min_id
    }).then(res => {
      // 把之前得到的聊天数据和重新加载的拼接在一起
      res.data.reverse().forEach(item => {
        this.data.chatList.data.unshift(item)
      })
      this.data.chatList.min_id = res.min_id;
      var that = this;
      setTimeout(function () {
        that.setData({
          chatList: that.data.chatList,
          loading: false
        })
      }, 500)
    }).catch(err => {
      Event.initShowToast(err, this);
    })
  },

  wssInit() {
    var that = this;
    this.connectWss();
    // 链接失败显示
    wx.onSocketError(function (res) {
      console.log('WebSocket连接打开失败，请检查！', res);
      that.setData({
        isOpen: false,
        statusMsg: '已断开'
      });
    });
    // 监听连接成功
    wx.onSocketOpen(function (res) {
      that.setData({
        isOpen: true,
        statusMsg: '已连接'
      });
      that.handleGetChatList()
      wx.onSocketMessage(function (res) {
        var res_data = JSON.parse(res.data);
        if (res_data.errcode > 0) {
          wx.showToast({
            title: '内容涉及敏感信息！',
            icon: 'none',
            duration: 2000
          })
        }
        if (!res_data.msg && !res_data.rooms) {
          that.data.UserChatList.push(res_data)
          that.setData({
            isUser: true,
            UserChatList: that.data.UserChatList
          })
          setTimeout(function () {
            wx.createSelectorQuery().select('#chatContent').boundingClientRect(function (rect) {
              that.setData({
                scrollTop: rect.height + 100000
              })
            }).exec()
          }, 500)
        } else {
          if (res_data.msg) {
            wx.showToast({
              title: res_data.msg,
              icon: 'none',
              duration: 3000
            })
          }
        }
      });
      wx.sendSocketMessage({
        data: JSON.stringify({
          token: wx.getStorageSync('token'),
          resource_id: that.data.resource_id,
          book_id: that.data.book_id,
        }),
        success: res => {
          console.log(res + '发送成功')
        },
        fail: err => {
          console.log(err + '失败')
        }
      });
    })
  },
  // 向服务器发送消息
  handleSendMessage: function () {
    var that = this;
    this.setData({
      text_height_show: false
    })
    /**
     * author jiayin
     * time 19.1.11
     * 加标识，避免重复连接
     */
    if (this.data.is_connect) {
      this.connect()
    }
    if (that.data.content.trim() == '') {
      wx.showToast({
        title: '内容不能为空！',
        icon: 'none',
        duration: 2000
      })
      return;
    }
    wx.sendSocketMessage({
      data: JSON.stringify({ content: that.data.content }),
      success: res => {
        that.setData({
          input_value_content: '',
          content: '',
        })
      }
    });
  },
  connectWss: function () {
    this.setData({
      statusMsg: '连接中。。。'
    });
    this.connect();
  },
  handleGetFocus (e) {
    this.setData({
      text_height_show: true,
      text_height: e.detail.height
    })
  },
  handleShowHeight () {
    this.setData({
      text_height_show: false
    })
  },
  /**
   * author jiayin
   * time 19.1.11
   * 把socket链接转到内部
   * 连接之后加上标识，避免重复连接
   */
  connect() {
    let that = this
    wx.connectSocket({
      url: 'wss://api.tl100.com/wss',
      success: function (res) {
        console.log('连接成功');
        that.setData({
          is_connect: false
        })
      },
      fail: function (err) {
        if (err) {
          app.globalData.socketConnectFail = true;
        }
      }
    });
  }
})