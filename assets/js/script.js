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
// Create main cursor element
const cursor = document.createElement('div');
cursor.classList.add('cursor');
document.body.appendChild(cursor);

// Create trail elements
const trails = [];
const trailCount = 8; // Adjust the number of trails if needed

for (let i = 0; i < trailCount; i++) {
    const trail = document.createElement('div');
    trail.classList.add('trail');
    document.body.appendChild(trail);
    trails.push(trail);
}

// Mouse position tracker
let mouseX = 0;
let mouseY = 0;

// Update mouse position
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.left = `${mouseX}px`;
    cursor.style.top = `${mouseY}px`;
});

// Trail effect
const trailPositions = Array(trailCount).fill({ x: mouseX, y: mouseY });

function animateTrails() {
    // Update each trail's position with a slight delay
    trailPositions.unshift({ x: mouseX, y: mouseY });
    trailPositions.pop();

    trails.forEach((trail, index) => {
        const { x, y } = trailPositions[index];
        trail.style.left = `${x}px`;
        trail.style.top = `${y}px`;
    });

    requestAnimationFrame(animateTrails);
}

animateTrails();
