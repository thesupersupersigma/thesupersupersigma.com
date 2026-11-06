const startMenuButton = document.getElementById("startMenuButton");
const startMenu = document.getElementById("startMenu");
const internetExplorerButton = document.getElementById("internetExplorerButton");
const mediaPlayerButton = document.getElementById("mediaPlayerButton");
const shutdownButton = document.querySelector(".shutdownButton");

// Start menu
startMenuButton.addEventListener("click", function () {
    startMenu.classList.toggle("visible");
});

// Apps
internetExplorerButton.addEventListener("click", function () {
    alert("internetExplorer");
});

mediaPlayerButton.addEventListener("click", function () {
    alert("mediaPlayer");
});

shutdownButton.addEventListener("click", function () {
    let shutdown
    while (shutdown !== "yes" && shutdown !== "no") {
        ask();
        if (shutdown === "yes") {
            console.log("Shutting Down");
            window.location.replace("/shutdown");
        } else if (shutdown === "no") {
            console.log("Shutdown Aborted");
        } else {
            ask();
        }
    };

    function ask () {
        shutdown = prompt("Are you sure you want to shutdown?\n \n Type Yes or No");
        shutdown = shutdown.toLowerCase();
    }
});