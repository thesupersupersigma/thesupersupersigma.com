const startMenu = document.getElementById("startMenuButton");
const internetExplorer = document.getElementById("internetExplorerButton");
const mediaPlayer = document.getElementById("mediaPlayer");

// Start menu
startMenu.addEventListener("click", function () {
    startMenu.classList.toggle("visible");
});

// Apps
internetExplorer.addEventListener("click", function () {
    alert("internetExplorer");
});

mediaPlayer.addEventListener("click", function () {
    alert("mediaPlayer");
});