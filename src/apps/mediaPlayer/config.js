// Where Windows Media Player gets its media from. Change these to point anywhere.
// Paths are case-sensitive on the server, and every one must end with "/".

export const CONFIG = {
    // the folder that holds library/, playlists/, music/, video/, pictures/
    baseUrl: "https://media.thesupersupersigma.com/mediaPlayerData/",

    // folder names inside baseUrl
    folders: {
        library: "library/",
        playlists: "playlists/",   // .m3u / .m3u8 files
        music: "music/",           // the only one with subfolders: music/Artist/Album/tracks
        videos: "video/",
        pictures: "pictures/",
    },

    // album art file names to look for in each album folder (lowercase).
    // if none match, the first image in the folder is used.
    coverNames: ["folder.jpg", "cover.jpg", "front.jpg", "albumartsmall.jpg", "folder.png", "cover.png"],

    // how many songs to read the length of at once (each one is a small request)
    lengthRequestsAtOnce: 3,
};
