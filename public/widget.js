(function () {
  var s = document.currentScript;
  if (!s) return;
  var tid = s.getAttribute("data-tenant"), origin = new URL(s.src).origin;
  if (!tid) return;
  var btn = document.createElement("button");
  btn.textContent = "💬";
  btn.setAttribute("aria-label", "Chat with us");
  btn.style.cssText = "position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;border:0;background:#4338F0;color:#fff;font-size:24px;cursor:pointer;z-index:2147483646;box-shadow:0 4px 16px rgba(0,0,0,.25)";
  var frame = document.createElement("iframe");
  frame.src = origin + "/embed/" + encodeURIComponent(tid);
  frame.title = "Chat";
  frame.style.cssText = "position:fixed;right:20px;bottom:88px;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 110px);border:1px solid #e7e5e4;border-radius:14px;background:#fff;z-index:2147483646;display:none;box-shadow:0 8px 32px rgba(0,0,0,.2)";
  btn.onclick = function () { frame.style.display = frame.style.display === "none" ? "block" : "none"; };
  document.body.appendChild(frame);
  document.body.appendChild(btn);
})();
