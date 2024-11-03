'use strict';



/**
 * add event listener on multiple elements
 */

const addEventOnElements = function (elements, eventType, callback) {
  for (let i = 0, len = elements.length; i < len; i++) {
    elements[i].addEventListener(eventType, callback);
  }
}



/**
 * PRELOADER
 * 
 * preloader will be visible until document load
 */

const preloader = document.querySelector("[data-preloader]");

window.addEventListener("load", function () {
  preloader.classList.add("loaded");
  document.body.classList.add("loaded");
});



/**
 * MOBILE NAVBAR
 * 
 * show the mobile navbar when click menu button
 * and hidden after click menu close button or overlay
 */

const navbar = document.querySelector("[data-navbar]");
const navTogglers = document.querySelectorAll("[data-nav-toggler]");
const overlay = document.querySelector("[data-overlay]");

const toggleNav = function () {
  navbar.classList.toggle("active");
  overlay.classList.toggle("active");
  document.body.classList.toggle("nav-active");
}

addEventOnElements(navTogglers, "click", toggleNav);



/**
 * HEADER & BACK TOP BTN
 * 
 * active header & back top btn when window scroll down to 100px
 */

const header = document.querySelector("[data-header]");
const backTopBtn = document.querySelector("[data-back-top-btn]");

const activeElementOnScroll = function () {
  if (window.scrollY > 100) {
    header.classList.add("active");
    backTopBtn.classList.add("active");
  } else {
    header.classList.remove("active");
    backTopBtn.classList.remove("active");
  }
}

window.addEventListener("scroll", activeElementOnScroll);



/**
 * SCROLL REVEAL
 */

const revealElements = document.querySelectorAll("[data-reveal]");

const revealElementOnScroll = function () {
  for (let i = 0, len = revealElements.length; i < len; i++) {
    if (revealElements[i].getBoundingClientRect().top < window.innerHeight / 1.15) {
      revealElements[i].classList.add("revealed");
    } else {
      revealElements[i].classList.remove("revealed");
    }
  }
}

window.addEventListener("scroll", revealElementOnScroll);

window.addEventListener("load", revealElementOnScroll);

// MAGIC CURESOR

// Create a custom cursor element
// Create the main cursor element
const cursor = document.createElement('div');
cursor.classList.add('cursor');
document.body.appendChild(cursor);

// Create trailing elements
const trails = [];
for (let i = 0; i < 5; i++) { // Adjust number of trails if needed
    const trail = document.createElement('div');
    trail.classList.add('trail');
    document.body.appendChild(trail);
    trails.push(trail);
}

// Function to follow the mouse cursor
let mouseX = 0;
let mouseY = 0;
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.left = `${mouseX}px`;
    cursor.style.top = `${mouseY}px`;
});

// Animate trailing effect with a delay
let lastX = mouseX;
let lastY = mouseY;
function animateTrails() {
    let prevX = mouseX;
    let prevY = mouseY;

    trails.forEach((trail, index) => {
        // Each trail follows the previous position with a delay
        const delay = (index + 1) * 0.05; // Adjust delay for more/less trail spacing
        trail.style.left = `${lastX}px`;
        trail.style.top = `${lastY}px`;

        lastX += (prevX - lastX) * delay;
        lastY += (prevY - lastY) * delay;
        prevX = lastX;
        prevY = lastY;
    });

    requestAnimationFrame(animateTrails);
}

animateTrails();
