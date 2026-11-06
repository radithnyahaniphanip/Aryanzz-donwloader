(()=>{"use strict";
const $=id=>document.getElementById(id);
function normalizeWorkspaceLayout(){
  const toolsArea=$('toolsArea'),profilePanel=$('profile'),libraryPanel=$('history');
  const colorPanel=$('colorStudio'),mediaStudio=$('mediaStudio');
  if(toolsArea&&colorPanel&&colorPanel.parentElement!==toolsArea)toolsArea.insertBefore(colorPanel,profilePanel||null);
  if(toolsArea&&mediaStudio&&mediaStudio.parentElement!==toolsArea)toolsArea.insertBefore(mediaStudio,libraryPanel||null);
  if(profilePanel){
    const oldBackup=profilePanel.querySelector('.v25-backup-card');
    if(oldBackup&&libraryPanel){
      const currentBackup=libraryPanel.querySelector('.v25-backup-card');
      if(currentBackup&&currentBackup!==oldBackup)oldBackup.remove();
      else libraryPanel.appendChild(oldBackup);
    }
    profilePanel.querySelectorAll('.ary-theme-studio,[data-theme-studio],.v8813-security-center,#ownerLinkEditor,[data-profile-legacy]').forEach(node=>node.remove());
    profilePanel.querySelectorAll('#exportData,#importData,#restoreAutoBackup').forEach(node=>{
      const card=node.closest('.v25-backup-card');
      if(card)card.remove();else node.remove();
    });
    profilePanel.querySelectorAll('.v25-profile-card').forEach(card=>{
      if(/Tema\s*(?:&|dan)\s*Pengalaman|Backup\s*(?:&|dan)\s*Pemulihan|Media Studio Pro|Atur tautan sosial|Security Center/i.test(card.textContent||''))card.remove();
    });
    profilePanel.querySelectorAll('button,a,[role="button"]').forEach(node=>{
      if(/Tema\s*(?:&|dan)\s*Pengalaman|Backup\s*(?:&|dan)\s*Pemulihan|Media Studio Pro|Atur tautan sosial|Security Center/i.test(node.textContent||'')){
        const card=node.closest('.v25-profile-card,section');
        if(card&&card!==profilePanel)card.remove();else node.remove();
      }
    });
  }
  if(libraryPanel&&mediaStudio&&libraryPanel.contains(mediaStudio)&&toolsArea)toolsArea.insertBefore(mediaStudio,libraryPanel);
}

window.ARYANZZWorkspaceLayout=Object.freeze({normalize:normalizeWorkspaceLayout});
normalizeWorkspaceLayout();
})();