export const scenarios=[
 {key:'up_to_120',min:1,max:1.2,events:['Over 2.5']},
 {key:'range_120_130',min:1.2,max:1.3,events:['Over 2.5','1X','X2']},
 {key:'range_130_140',min:1.3,max:1.4,events:['Over 2.5','1X','X2']}
];
export function sixAM(now){const d=new Date(now);d.setUTCHours(6,0,0,0);return d.getTime();}
export function payload(rule,day,result){
 const filters={matchCount:2,minOdds:rule.min,maxOdds:rule.max,minProbability:1,maxProbability:100,leagues:'all',date:'today',...(rule.events.length===1?{event:'Over 2.5'}:{events:rule.events})};
 if(!result.evidence||result.evidence.length<20)throw Error('Missing visible evidence');
 if(result.empty){if(!result.evidence.includes('Sorry, there are no available matches.'))throw Error('Empty outcome is unverified');return {day,scenario:rule.key,filters,evidence:result.evidence,availability:'no_matches',picks:[]};}
 if(!result.picks?.length||result.picks.length>2)throw Error('Invalid generated count');
 const seen=new Set();for(const p of result.picks){if(seen.has(p.fixture)||!rule.events.includes(p.prediction)||p.odds<=1||p.odds<rule.min||p.odds>rule.max)throw Error('Generated pick outside filters');seen.add(p.fixture);}
 return {day,scenario:rule.key,filters,evidence:result.evidence,availability:'matches',picks:result.picks.map(p=>({...p,day}))};
}
