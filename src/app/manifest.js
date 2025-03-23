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
        sizes:"512x512",
        src:"minyi.png",
        type:"image/png"
      },
    ],
  }
}