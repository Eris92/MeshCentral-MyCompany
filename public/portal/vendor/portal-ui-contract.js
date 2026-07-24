(function(){
"use strict";
window.SirkPortalUiContract=window.SirkPortalUiContract||{};
window.SirkPortalUiContract.decorate=function(root){
  if(!root)return;
  root.querySelectorAll(".sirk-standalone-card,.mc-shared-card").forEach(function(node){node.classList.add("mc-portal-card");});
  root.querySelectorAll("button").forEach(function(node){if(!node.classList.contains("mc-portal-button"))node.classList.add("mc-portal-button");});
};
})();
