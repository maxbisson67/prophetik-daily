// functions/test-espn-parse.js
import { fetchAllNHLInjuriesFromESPN } from "./utils/espnApi.js";

async function test() {
  console.log("🏒 Testing ESPN API...\n");
  
  const injuries = await fetchAllNHLInjuriesFromESPN();
  
  console.log(`\n📊 Results:`);
  console.log(`Total injuries: ${injuries.length}`);
  
  if (injuries.length > 0) {
    console.log(`\n🔍 First 5 injuries:\n`);
    injuries.slice(0, 5).forEach((inj, i) => {
      console.log(`${i + 1}. ${inj.playerName} (${inj.teamAbbrev})`);
      console.log(`   Status: ${inj.strStatus}`);
      console.log(`   Injury: ${inj.strInjury}`);
      console.log(`   Return: ${inj.returnDate || 'Unknown'}`);
      console.log('');
    });
  }
}

test().catch(console.error);