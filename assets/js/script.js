'use strict';

// Event List Adder on multiple elements
const addEventOnElements = function (elements, eventType, callback) {
    for (let i = 0, len = elements.length; i < len; i++) {
        elements[i].addEventListener(eventType, callback);
    }
}

// Preloader
//   will be visible until document loads
const preloader = document.querySelector("[data-preloader]");

window.addEventListener("load", function () {
    if (preloader) {
        preloader.classList.add("loaded");
    }
    document.body.classList.add("loaded");
})
