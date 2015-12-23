$(function(){
  // はじめにこの拡張が動作する環境かどうかチェック
  enableThisExtentionCheck();

  var target = document.getElementById("_roomListItems");

  var options = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true
  };

  // DOMの監視開始
  var mo = new MutationObserver(notification);
  mo.observe(target, options);

  // 通知再開・停止ボタン
  var notify_change_button_html = '<li id="notify_change_button" class="linkstatus _showDescription" aria-label="オリジナル通知on/off">';
  notify_change_button_html += '<span class="adminNavi__btn icoFontActionUnread"></span>';
  notify_change_button_html += '<span id="on_off" class="numAdminCount" style="">on</span></li>';
  $('#_adminNavi').prepend(notify_change_button_html);

  $('#notify_change_button').on('click', function(){
    var on_off = $('#on_off').text();
    if(on_off === 'on'){
      $('#on_off').text('off');
      mo.disconnect();
    } else {
      $('#on_off').text('on');
      mo.observe(target, options);
    }
  });

  // 通知時間自由入力欄
  var time_input_html = '<li class="linkstatus _showDescription" aria-label="デスクトップ通知表示時間"><input id="close_time" type="text" placeholder="通知表示時間(秒)" style="width: 100px;"></li>';
  $('#_adminNavi').prepend(time_input_html);

  // 通知をミュートにする用のアイコンをチャットルーム一覧に付与
  // FIX: チャットルームリストが更新されると消えてしまう問題
  $("li._roomLink").append('<button class="notify_off button btnPrimary">on</button>');
  $('.notify_off').on('click', function(){
    var rid = $(this).parent().attr('data-rid');
    var on_off = $(this).text();
    if(on_off === 'on'){
      $(this).text('off');
      $(this).addClass('btnDanger');
      $(this).removeClass('btnPrimary');
      $('#_logo').append('<div class="notify_off_cache" style="display: none">'+rid+'</div>');
    } else {
      $(this).text('on');
      $(this).addClass('btnPrimary');
      $(this).removeClass('btnDanger');
      $.each($('.notify_off_cache'), function(){
        if($(this).text() === rid){
          $(this).remove();
        }
      });
    }
  });

});



// 動作するかどうかの確認処理をまとめた関数
// console.logに状態をはく
function enableThisExtentionCheck(){
  if(Notification.permission === "granted"){
    console.log('許可されています');
  } else {
    // 許可がない場合には許可を求める
    Notification.requestPermission();
  }
}

// message_idからmessage_contentsを取得するメソッド
function getMessage(message_id){
  var contents = $("[data-mid="+message_id+"]").find('pre').text();
  return contents;
}

// message_idから発言者のアイコンを取得するメソッド
// アイコンが取得できない場合はチャットを遡る
function getSpeakerIcon(message_id){
  var icon = $("[data-mid="+message_id+"]").find('img').first()[0];
  if(typeof(icon) !== 'undefined' && /avatarMedium/.test($("[data-mid="+message_id+"]").find('img').first().attr('class'))){
    return icon.getAttribute('src');
  }

  var dom = $("[data-mid="+message_id+"]").siblings().get().reverse();
  var icon = '';
  $.each(dom, function(){
    var obj = $(this).find('img').first()[0];
    if(typeof(obj) !== 'undefined'){
      icon = obj.getAttribute('src');
      return false; // breakの代わり
    }
  });

  return icon;
}

// DOMの変更を監視し、変更があった時に実行されるメソッド
// 今回の拡張のコアになるメソッド
function notification(data1, data2) {
  console.log("DOM要素の変更を感知しました");
  // チャットワークにフォーカスが当たっていない時のみ通知機能を使う
  // タブがアクティブの時は処理しない
  // クリックイベントを発生させていて読み途中・書き途中でチャットルームが変わってしまうのを防ぐため
  if(document.hasFocus()){
    return;
  }

  // 画面からキャッシュがあればそれを読みだす
  var old_value_obj = $('.old_value');
  var old_value_array = [];
  $.each(old_value_obj, function(index, value){
    old_value_array[index] = $(this).text();
  });

  $.each(data1[0]['addedNodes'], function(index, value){
    // チャットリストに未読のバッチがついた時に発火する
    // ここの条件がフィルタになるので色々作れる
    if(/_unreadBadge unread/.test(value.outerHTML)){
      var room_id = value.getAttribute('data-rid');
      // 通知しないチャットルームなら通知しない
      var notify_off_cache_obj = $(".notify_off_cache");
      var notify_off_cache_array = [];
      $.each(notify_off_cache_obj, function(index, value){
        notify_off_cache_array[index] = $(this).text();
      });
      if($.inArray(room_id, notify_off_cache_array) !== -1){
        return;
      }

      // このルームの中の最新のメッセージを取得する
      // このチャットのタブを開いていないとこの要素が存在しないので一旦クリックして要素を出現させる
      // FIX: 未読バッチが消えてしまう問題
      $("li[data-rid="+room_id+"]").click();
      setTimeout(function(){
        var message_id = $("div[data-rid="+room_id+"]._message").last().data('mid');
        if(typeof(message_id) === 'undefined'){
          return;
        }
        var message_contents = getMessage(message_id);

        // キャッシュデータと差があれば通知
        // 差がなければ既に通知済とみなす
        if($.inArray(String(message_id), old_value_array) !== -1){
          return;
        }

        // 通知済のメッセージIDを画面にキャッシュ
        // body内だと要素が変更されてしまうので適当にヘッダー内のlogoに仕込んだ
        // とりあえずキャッシュは20個まで、根拠は特に無し
        var max_cache = 20;
        var index = old_value_array.length % max_cache;
        $('#old_value_'+index).remove();
        $('#_logo').append('<div id="old_value_'+index+'" class="old_value" style="display: none">'+message_id+'</div>');

        var icon = getSpeakerIcon(message_id);
        var author = value.getAttribute('aria-label');
        var options = {
            body: message_contents,
            icon: icon
        }
        var notify_obj = new Notification(author ,options);

        // 時間経過で通知を消す
        var close_time = $('#close_time').val();
        if(typeof(close_time) === 'undefined' || !isFinite(close_time) || close_time === ''){
          // デフォルト5秒
          close_time = 5;
        }
        close_time = close_time * 1000;
        setTimeout(function(){
          notify_obj.close();
        }, close_time);

        // 該当のチャットに飛ぶ
        notify_obj.onclick = function(){
          window.location.href = 'https://www.chatwork.com/#!rid'+room_id;
          window.focus();
        }
      }, 2000);
    }
  });
}