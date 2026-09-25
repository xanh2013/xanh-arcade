// Twenty original additions. Reuse the three existing ammo families and backpack UI.
const weapon=(name,kind,mag,damage,delay,speed,range,spread,reload,ammo,rank=3,pellets=1)=>({name,kind,mag,damage,delay,speed,range,spread,reload,ammo,rank,pellets});
export const NEW_WEAPONS={
 kestrel:weapon('Kestrel 9','Súng ngắn',18,9,.22,1080,700,.028,1.1,'light',2),
 marshal:weapon('Marshal .45','Súng ngắn',8,21,.48,1150,820,.02,1.45,'light',2),
 lotus:weapon('Lotus Auto','Súng ngắn',22,6,.12,1000,550,.055,1.35,'light',2),
 talon:weapon('Talon R6','Súng ngắn',6,29,.68,1320,900,.018,1.8,'heavy'),
 lynx:weapon('Lynx S9','Tiểu liên',36,7,.105,1120,640,.05,1.7,'light'),
 cicada:weapon('Cicada 45','Tiểu liên',45,5,.085,1020,580,.07,2,'light'),
 vectora:weapon('Vectora K','Tiểu liên',24,9,.115,1220,720,.038,1.35,'light'),
 wisp:weapon('Wisp PDW','Tiểu liên',30,8,.13,1160,750,.032,1.5,'light'),
 cedar:weapon('Cedar A1','Súng trường',30,13,.18,1420,1150,.022,1.9,'heavy'),
 anvil:weapon('Anvil 762','Súng trường',25,18,.25,1350,1200,.036,2.1,'heavy'),
 heron:weapon('Heron Mk2','Súng trường',36,10,.14,1400,1080,.026,1.85,'heavy'),
 aurora:weapon('Aurora R4','Súng trường',28,15,.21,1550,1350,.018,1.8,'heavy'),
 falcon:weapon('Falcon DMR','Bắn tỉa',12,29,.55,1800,1700,.009,2,'heavy'),
 tundra:weapon('Tundra S8','Bắn tỉa',5,54,1.5,2100,2300,.003,2.7,'heavy'),
 spectre:weapon('Spectre Scout','Bắn tỉa',8,36,.85,2000,1950,.006,2.15,'heavy'),
 mammoth:weapon('Mammoth AM','Bắn tỉa',4,68,1.95,2200,2500,.004,3.1,'heavy'),
 tempest:weapon('Tempest 12','Shotgun',8,5,.65,980,370,.26,2.1,'shell',3,8),
 boar:weapon('Boar Double','Shotgun',2,8,.38,1100,420,.22,1.9,'shell',3,7),
 bastion:weapon('Bastion LMG','Súng máy',70,10,.15,1350,1100,.045,3.6,'heavy'),
 dragonfly:weapon('Dragonfly LMG','Súng máy',90,7,.11,1280,950,.058,4,'heavy')
};
