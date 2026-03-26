import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import assert from 'assert';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testAppFunctions() {
  console.log("=== Testing App Functions ===");
  try {
    // 1. Add Player
    console.log("1. Adding player...");
    const name = "TestPlayer_" + Date.now();
    const { data: pInsert, error: e1 } = await supabase.from('players').insert([{ name, status: 'waiting' }]).select();
    if(e1) throw e1;
    const playerId = pInsert[0].id;
    console.log("✅ Player added:", name);

    // 2. Add second player for match
    console.log("2. Adding second player...");
    const name2 = "TestPlayer2_" + Date.now();
    const { data: pInsert2, error: e2 } = await supabase.from('players').insert([{ name: name2, status: 'waiting' }]).select();
    if(e2) throw e2;
    const player2Id = pInsert2[0].id;
    console.log("✅ Second player added:", name2);

    // 3. Create Match
    console.log("3. Creating match...");
    const { data: mInsert, error: e3 } = await supabase.from('matches').insert([{
      player_a_id: playerId, player_b_id: player2Id,
      score_a: 11, score_b: 7, winner_id: playerId
    }]).select();
    if(e3) throw e3;
    console.log("✅ Match created successfully!");

    // 4. Update player wins and status
    console.log("4. Updating player stats...");
    const { error: e4 } = await supabase.from('players').update({ wins: 1, matches_played: 1, status: 'idle' }).eq('id', playerId);
    if(e4) throw e4;
    console.log("✅ Player stats updated!");

    // Cleanup
    console.log("5. Cleaning up...");
    await supabase.from('players').delete().in('id', [playerId, player2Id]);
    await supabase.from('matches').delete().eq('id', mInsert[0].id);
    console.log("✅ Cleanup complete!");
    console.log("🎉 All UI database queries have been tested and verified.");
  } catch(err) {
    console.error("❌ Test Failed:", err.message || err);
  }
}

testAppFunctions();
