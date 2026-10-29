/**
 * Event datetimes without an explicit UTC offset represent Prague venue
 * wall time in the TicketTreat Czech pilot.
 *
 * Return an absolute epoch for countdowns. Explicit offset/Z stays absolute.
 * DST gaps are rejected instead of producing an incorrect admission time.
 */
export function venueStartEpoch(value: string): number {
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return Date.parse(value);
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if(!match)return NaN;
  const [year,month,day,hour,minute,second]=match.slice(1).map(Number);
  const wall=Date.UTC(year,month-1,day,hour,minute,second||0);
  if(!Number.isFinite(wall))return NaN;
  const formatter=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
  });
  const renderedWall=(instant:number)=>{
    const fields=Object.fromEntries(formatter.formatToParts(new Date(instant))
      .filter(p=>p.type!=="literal").map(p=>[p.type,Number(p.value)]));
    return Date.UTC(fields.year,fields.month-1,fields.day,fields.hour,fields.minute,fields.second);
  };
  let guess=wall;
  for(let i=0;i<4;i++){
    const delta=wall-renderedWall(guess);
    if(delta===0)return guess;
    guess+=delta;
  }
  return renderedWall(guess)===wall?guess:NaN;
}
