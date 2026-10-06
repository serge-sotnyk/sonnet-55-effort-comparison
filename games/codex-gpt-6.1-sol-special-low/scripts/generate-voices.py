import subprocess,json,os
voices={
'Britons':('Daniel',{'select':['Ic eom gearu.','Hlaford?','Gea, min hlaford.'],'move':['Ic gange.','To thaere stowe.','Forth, min hlaford.'],'gather':['Ic wyrce.','To weorce.'],'build':['Ic timbrie.','Ic wyrce hus.'],'attack':['Forth to guthe!','For tham cyninge!']}),
'Franks':('Thomas',{'select':['Oïl, sire.','À vostre service.','Prêt, mon seigneur.'],'move':['Je vais.','En avant.','Par ici.'],'gather':['Au travail.','Je recueille.'],'build':['Je bâtis.','À la besogne.'],'attack':['Montjoie!','Pour le roi!']}),
'Byzantines':('Melina',{'select':['Έτοιμος.','Πρόσταγμα.','Μάλιστα.'],'move':['Πορεύομαι.','Εμπρός.'],'gather':['Εργάζομαι.','Συλλέγω.'],'build':['Οικοδομώ.','Θεμελιώνω.'],'attack':['Επίθεση!','Για την αυτοκρατορία!']}),
'Vikings':('Nora',{'select':['Já, herra.','Til tjeneste.','Ek em búinn.'],'move':['Ek geng.','Fram.','Þangað.'],'gather':['Ek vinn.','Til verks.'],'build':['Ek byggi.','Hér rís hús.'],'attack':['Til vígs!','Fyrir konung!']})}
manifest={}
for civ,(voice,actions) in voices.items():
 manifest[civ]={}
 for action,lines in actions.items():
  manifest[civ][action]=[]
  for i,line in enumerate(lines):
   p=f'audio/{civ.lower()}-{action}-{i}.wav'
   subprocess.run(['say','-v',voice,'-r','165','-o',p,'--file-format=WAVE','--data-format=LEI16@22050',line],check=True,stdout=subprocess.DEVNULL)
   manifest[civ][action].append(p)
open('audio/manifest.json','w').write(json.dumps(manifest))
