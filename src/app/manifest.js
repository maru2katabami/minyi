export default function manifest() {
  return {
    name:"minyi",
    short_name:"minyi",
    start_url:"/",
    display:"standalone",
    background_color:"#ffffff",
    theme_color:"#ffffff",
    orientation:"any",
    dir:"auto",
    lang:"ja",
    icons:[
      {
        purpose:"maskable",
        sizes:"512x512",
        src:"icon512_maskable.png",
        type:"image/png"
      },
      {
        purpose:"any",
        sizes:"512x512",
        src:"icon512_rounded.png",
        type:"image/png"
      }
    ],
  }
}