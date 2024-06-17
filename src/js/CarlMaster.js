// TODO:
// done | allow extra pokemon to be added to rank list
// !done | allow ap string for tracking all hundo, and anyIV (frigibax, etc)
// !done | refactor code to make easier to follow
// !done | consolidate tracking commands eg if tracking hundo and pokemone in ranklist needs perfect iv, dont add ranklist tracking
// !done | write deployable app to pull results of script and create copyable strings
// !done | figure out how latest ranking data is pulled and deploy pvpoke code that stays updated?


const gm = GameMaster.getInstance();
const self = this;
const category = 'overall';
const league = [1500, 2500, 10000];
const cup = 'all';
const takeN = 20;
let fullSearchStr = '';
let fullStrArr = new Set();
let apCmdsStr = '';
let nonPvPSearchStr = '';
const apSearchDistance = 3000;
let extraPkmInLeague = [{ speciesId: 'skeledirge', league: 2500 }];
let extraPkmNoLeague = ['frigibax'];


let rankData = null;
gm.returnRankingData = function (category, league, cup, takeN) {
    var key = cup + "" + category + "" + league + "" + takeN;

    if (!gm.rankings[key]) {
        var file = webRoot + "data/rankings/" + cup + "/" + category + "/" + "rankings-" + league + ".json?v=" + siteVersion;

        $.getJSON(file, function (data) {
            const rankingDataCopy = JSON.parse(JSON.stringify(data));

            data = data.slice(0, takeN);
            console.log('data: ', data);

            extraPkmInLeague.forEach(p => {
                if (league === p.league) {
                    let extraPokemon = rankingDataCopy.find(d => {
                        return d.speciesId === p.speciesId;
                    });
                    data.push(extraPokemon);
                }
            });
            console.log('newData: ', data);
            gm.rankings[key] = data;
            gm.loadedData++;
        });
    }
}

let count = 0;
const loops = league.length;

/**
 * For each league (master: 10000, Ultra: 2500, Great: 1500):
 * get list of pokemon rank data
 * get rank1 IVs for each pokemon in list
 * generate search string containing all pokemon in that league
 */
league.forEach(l => {
    gm.returnRankingData(category, l, cup, takeN);
    const battle = new Battle();
    battle.setCup(cup);
    battle.setCP(l);

    if (!battle.getCup()?.levelCap) {
        battle.setLevelCap(50);
    }

    setTimeout(() => {
        rankData = gm.rankings[cup + '' + category + '' + l + '' + takeN];
        rankData?.forEach(d => {
            d['Rank1_IV'] = getIVCombo(d, battle);
        });
        getSearchString(l, rankData);
        count++;
    }, 500);
});

/**
 * Prints out search string for ALL leagues and all AP commands
 */
const inter = setInterval(() => {
    if (count === loops) {
        fullSearchStr += [...fullStrArr].join(', ');
        fullSearchStr.trim().slice(0, -2);
        console.log('fullsearchstr: ', fullSearchStr);
        console.log('apCmdsStr: ', apCmdsStr);
        clearInterval(inter);
    }
}, 500);


// !track  command examples:
// !track pikachu d800   Tracks pikachu within 800 meters of location.One mile is approximately 1600 meters.
// !track pikachu d1000 iv90    Tracks pikachu within 1km with a minimum IV of 90 %
// !track pikachu d1000 iv0 maxiv0    Tracks pikachu within 1k and only 0 % IV - when setting a maxiv - iv0 is also required to avoid non - encountered Pokemon.
// !track shuckle d2000 cp300    Tracks shuckle with a minimum CP of 300, within 2km
// !track shuckle maxcp400 d2500    Tracks shuckle with a maximum CP of 400, within 2500m
// !track shuckle level20 d1500  Tracks shuckle with a minimum level 20, within 1.5km
// !track shuckle maxlevel1 iv0 d1000  Tracks shuckle with a maximum level 1(within 1km) - you need the iv0 to ensure it only notifies on encountered Pokemon.
// !track eevee d1000 atk15  Tracks eevee with a(minimum) 15 point attack value(within 1km)
// !track eevee d1000 def14  Tracks eevee with a(minimum) 14 point defense value(within 1km)
// !track eevee sta10 d1000  Tracks eevee with a(minimum) 10 point stamina value(within 1km)
// !track eevee maxatk0 iv0 d1000  Tracks eevee with a(maximum) 0 point attack value.iv filter is necessary to avoid any unencountered mon(those with no iv data).(within 1km)
// !track eevee d1000 def10 maxdef14 iv0  Tracks eevee with a 10 - 14 point defense value. (within 1km)
// !track mr_mime farfetchd  Tracks Mr.Mime & Farfetch'd at the default of 5km.

/**
 * Creates string of alphapokes commands
 * @param {PokeRankObj} poke 
 * @param {string} pokeName Name of the pokemon
 */
function getAPCommands(poke, pokeName) {
    console.log('getAPCommands: ', poke, pokeName);
    // get pokemon
    const pokeObj = gm.getPokemonById(poke.speciesId);
    generateAPCommStr(pokeName);
    const famList = getPokeFamily(pokeObj);
    if (famList?.length > 0) {
        famList.forEach(p => {
            generateAPCommStr(p.speciesName, true);
        })
    }

    function generateAPCommStr(name) {
        // construct string
        const pokeIVs = poke.Rank1_IV.ivs;
        apCmdsStr += `!track ${name.replace(' ', '_')} d${apSearchDistance} iv0`;
        apCmdsStr += ' ';
        apCmdsStr += (pokeIVs.atk === 0 ? 'maxatk0' : pokeIVs.atk === 15 ? 'atk15' : `atk${pokeIVs.atk} maxatk${pokeIVs.atk}`);
        apCmdsStr += ' ';
        apCmdsStr += (pokeIVs.def === 0 ? 'maxdef0' : pokeIVs.def === 15 ? 'def15' : `def${pokeIVs.def} maxdef${pokeIVs.def}`);
        apCmdsStr += ' ';
        apCmdsStr += (pokeIVs.hp === 0 ? 'maxsta0' : pokeIVs.hp === 15 ? 'sta15' : `sta${pokeIVs.hp} maxsta${pokeIVs.hp}`);

        const maxLevel = Math.ceil(poke.Rank1_IV.level);
        apCmdsStr += ' ';
        apCmdsStr += 'level1 maxlevel' + maxLevel;

        apCmdsStr += '\n';
    }
}

/**
 * Returns a comma delimited string of Pokemon names in list of PokeRankObj for the league passed
 * Adds pokemon in pokeList to set used to create a search string for pokemon in ALL leagues
 * Adds Pokemon in pokeList list to set used to create search string for pokemon in league passed
 * Generates AP commands for each pokemon in GREAT/ULTRA league. Master not needed since IV is always perfect
 * @param {number} league league the pokeList is for
 * @param {PokeRankObj[]} pokeList List of PokeRankObj 
 * @returns 
 */
function getSearchString(league, pokeList) {
    let searchStr = ''
    switch (league) {
        case 1500:
            searchStr += 'GL1500: '
            break;
        case 2500:
            searchStr += 'UL2500: '
            break;
        case 10000:
            searchStr += 'ML: '
            break;
        default:
            break;
    }
    const leagueList = new Set();
    pokeList.forEach(poke => {
        const pokeName = poke.speciesName.replace(/ *\([^)]*\) */g, "");
        fullStrArr.add(pokeName);
        leagueList.add(pokeName);
        if (league !== 10000 && !poke.speciesName.toLowerCase().includes('shadow')) {
            getAPCommands(poke, pokeName);
        }

    });
    searchStr += [...leagueList].join(', ')
    searchStr = searchStr.trim();
    console.log('leagueStr: ', searchStr);
    return searchStr;
}


/**
 * Gets IV combo for Rank1 in the league the battle is for
 * @param {PokeRankObj} pokemon 
 * @param {BattleObj} battle 
 * @returns 
 */
function getIVCombo(pokemon, battle) {
    const poke = new Pokemon(pokemon.speciesId, 0, battle);
    poke.initialize(battle.getCP(), "gamemaster");
    
    var rank1Combo = poke.generateIVCombinations("overall", 1, 1)[0];
    // var highestLevelCombo = poke.generateIVCombinations("level", 1, 1)[0];

    // var level41CP = poke.calculateCP(0.795300006866455, 15, 15, 15);

    poke.autoLevel = true;
    poke.setIV("atk", 15);
    poke.setIV("def", 15);
    poke.setIV("hp", 15);

    return rank1Combo;
}

/**
 * Returns previous evolutions of pokemon
 * @param {PokeObj} poke PokeObj to find previous evo for
 * @returns Array of PokeObj
 */
function getPokeFamily(poke) {
    let familyList = [];
    let pokeObj = poke;

    while (pokeObj?.family?.parent) {
        const pokeParent = gm.getPokemonById(pokeObj.family.parent);
        familyList.push(pokeParent);
        pokeObj = pokeParent;
    }
    return familyList;
}