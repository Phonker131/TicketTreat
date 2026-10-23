import {ImageResponse} from "next/og";

// Raster formats (Apple touch icon, PWA) use the same approved
// two-line TicketTreat wordmark/ticket art as public/favicon.svg.
const svg="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" width=\"128\" height=\"128\"><rect width=\"128\" height=\"128\" rx=\"15\" fill=\"#F0EBE1\"/><g transform=\"translate(5 8) scale(.392)\"><text x=\"5\" y=\"100\" font-family=\"Archivo Black,Arial,sans-serif\" font-size=\"105\" font-weight=\"900\" fill=\"#FF5533\" textLength=\"294\" lengthAdjust=\"spacingAndGlyphs\">TICKET</text><text x=\"0\" y=\"96\" font-family=\"Archivo Black,Arial,sans-serif\" font-size=\"105\" font-weight=\"900\" fill=\"#15141F\" textLength=\"294\" lengthAdjust=\"spacingAndGlyphs\">TICKET</text><g transform=\"translate(0 121)\"><path d=\"M6,0 L294,0 A6,6 0 0 1 300,6 L300,39 A11,11 0 0 0 300,61 L300,94 A6,6 0 0 1 294,100 L6,100 A6,6 0 0 1 0,94 L0,61 A11,11 0 0 0 0,39 L0,6 A6,6 0 0 1 6,0 Z\" transform=\"translate(6,5)\" fill=\"#F4B400\"/><path d=\"M6,0 L294,0 A6,6 0 0 1 300,6 L300,39 A11,11 0 0 0 300,61 L300,94 A6,6 0 0 1 294,100 L6,100 A6,6 0 0 1 0,94 L0,61 A11,11 0 0 0 0,39 L0,6 A6,6 0 0 1 6,0 Z\" fill=\"none\" stroke=\"#15141F\" stroke-width=\"5\"/><text x=\"20\" y=\"82\" font-family=\"Archivo Black,Arial,sans-serif\" font-size=\"94\" font-weight=\"900\" fill=\"#15141F\" textLength=\"262\" lengthAdjust=\"spacingAndGlyphs\">TREAT</text></g></g></svg>";
export function ticketTreatIcon(size:number):ImageResponse {
  const image="data:image/svg+xml;base64,"+btoa(svg);
  return new ImageResponse(
    <div style={{width:size,height:size,display:"flex"}}>
      <img src={image} alt="TicketTreat" width={size} height={size}/>
    </div>, {width:size,height:size}
  );
}
