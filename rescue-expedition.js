(function(root){
  const title='Blackout at River Gate';
  const types=['expedition-solo','expedition-squad'];
  const routes={
    clinic:{name:'Restore the clinic',choice:'Power up the clinic so it can treat the injured before their escort.',result:'The clinic reopened. All three patients could be stabilized before the escort.'},
    bridge:{name:'Reopen the bridge',choice:'Open a shorter crossing. Expect an extra tiger patrol at the bridge.',result:'The bridge reopened. The squad used a shorter crossing and cleared its extra patrol.'},
  };
  const stages=['Restore the route','Bring everyone out','Get them home'];
  const adventures={
    'river-gate':{id:'river-gate',title,routes,stages,description:'A blackout has cut off River Gate. Choose which route to restore before bringing three survivors to the rescue boat.'},
    'flooded-village':{
      id:'flooded-village',title:'Flooded Village',
      description:'The helicopter reaches a village as floodwater rises. Prepare a rescue boat or restore the shelter, then bring four stranded villagers home.',
      stages:['Prepare the evacuation','Reach stranded families','Escape the flood'],
      routes:{
        boat:{name:'Repair the rescue boat',choice:'Restore the ferry. Bring the whole rescue party to its landing for a dry crossing.',result:'The repaired ferry carried the rescue party across the flood.'},
        shelter:{name:'Restore the village shelter',choice:'Restore shelter power. Use the longer bridge route and stabilize the injured before evacuation.',checkpointResult:'The injured villagers reached the restored shelter. Treatment is available before the final evacuation.',result:'The restored shelter stabilized all four injured villagers before evacuation.'},
      },
    },
    'mountain-sos':{
      id:'mountain-sos',title:'Mountain SOS',transport:'helicopter',
      description:'Follow a mountain distress signal, bring a medical team to three stranded hikers, then defend their helicopter evacuation. Choose a longer forest trail or a shorter, more dangerous ridge crossing.',
      stages:['Find the missing hikers','Bring supplies through','Hold the landing zone'],
      routes:{
        forest:{checkpointResult:'The forest footbridge is repaired. The medic and three hikers reached the shelter and received treatment. Next, defend their helicopter evacuation.',name:'Safer forest trail',choice:'Repair the forest footbridge. Take a longer marked trail with fewer tiger patrols.',result:'The repaired forest footbridge opened the longer rescue trail. The medical team treated all three hikers before their helicopter evacuation.'},
        ridge:{checkpointResult:'The ridge crossing is repaired and its extra patrol cleared. The medic and three hikers reached the shelter and received treatment. Next, defend their helicopter evacuation.',name:'Faster ridge crossing',choice:'Repair the ridge crossing. Take a shorter trail with an extra tiger patrol in the escort stage.',result:'The repaired ridge crossing shortened the escort. The squad cleared its additional patrol and treated all three hikers before helicopter evacuation.'},
      },
    },
  };
  function definition(id='river-gate'){return Object.hasOwn(adventures,id)?adventures[id]:null;}
  const checkpointIds=['exp_clinic_power','exp_bridge_open','exp_triage','exp_crossing','fv_boat_repair','fv_shelter_power','fv_home_west','fv_home_east','fv_stabilize','ms_signal','ms_forest_bridge','ms_ridge_bridge','ms_crossing','ms_treatment'];
  const holdMs=8000;
  const isExpedition=type=>types.includes(type);
  const isSolo=type=>type===types[0];
  const api={title,types,routes,stages,adventures,definition,checkpointIds,holdMs,isExpedition,isSolo};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TigerRescueExpedition=api;
})(globalThis);
