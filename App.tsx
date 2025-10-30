import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ControlsPanel } from './components/ControlsPanel';
import { GraphVisualizer } from './components/GraphVisualizer';
import { InfoPanel } from './components/InfoPanel';
import { MAPS as INITIAL_MAPS } from './data/maps';
import { solveMapColoringGenerator } from './services/coloringService';
import type { Graph, ColorMapping, Step, MapDefinition } from './types';
import { buildGraph } from './utils/graphUtils';
import { COLOR_PALETTE as DEFAULT_PALETTE } from './constants';

const App: React.FC = () => {
  const [maps, setMaps] = useState<Record<string, MapDefinition>>(INITIAL_MAPS);
  const [selectedMapKey, setSelectedMapKey] = useState<string>(Object.keys(INITIAL_MAPS)[0]);
  const [numColors, setNumColors] = useState<number>(4);
  const [colorPalette, setColorPalette] = useState<string[]>(DEFAULT_PALETTE.slice(0, 4));
  const [currentGraph, setCurrentGraph] = useState<Graph>(buildGraph(maps[selectedMapKey]));
  const [colorMapping, setColorMapping] = useState<ColorMapping>({});
  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('Ready. Select a map and click "Color Map" to start.');
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const solverRef = useRef<Generator<Step, ColorMapping | null, void> | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const mapDef = maps[selectedMapKey];
    if (mapDef) {
      setCurrentGraph(buildGraph(mapDef));
      resetState();
      setUploadError(null);
    } else if (selectedMapKey === 'custom') {
      setCurrentGraph({ nodes: [], edges: [], adjacencyList: {} });
      resetState();
      setStatus('Please upload a custom map file.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMapKey, maps]);

  const resetState = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    solverRef.current = null;
    animationFrameId.current = null;
    
    const initialMapping: ColorMapping = {};
    const mapDef = maps[selectedMapKey];
    if(mapDef) {
      mapDef.nodes.forEach(node => {
        initialMapping[node.id] = null;
      });
    }
    
    setColorMapping(initialMapping);
    setIsSolving(false);
    if (selectedMapKey !== 'custom' || maps.custom) {
        setStatus('Ready. Select a map and click "Color Map" to start.');
    }
    setHighlightedNode(null);
  }, [selectedMapKey, maps]);
  
  const handleNumColorsChange = (value: number) => {
    setNumColors(value);

    // Adjust the palette based on the new number of colors
    setColorPalette(prevPalette => {
      const newPalette = [...prevPalette];
      if (value > newPalette.length) {
        // Add new colors from the default palette if numColors increases
        const diff = value - newPalette.length;
        const additionalColors = DEFAULT_PALETTE.slice(newPalette.length, newPalette.length + diff);
        // Ensure we have fallback colors if default palette is exhausted
        for (let i = 0; i < diff - additionalColors.length; i++) {
            additionalColors.push(DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]);
        }
        return [...newPalette, ...additionalColors];
      } else if (value < newPalette.length) {
        // Truncate palette if numColors decreases
        return newPalette.slice(0, value);
      }
      return prevPalette;
    });
  };

  const handleCustomMapUpload = (newMapDef: MapDefinition) => {
    const newMaps = { ...maps, custom: newMapDef };
    setMaps(newMaps);
    setSelectedMapKey('custom');
    setStatus('Custom map loaded. Ready to solve.');
    setUploadError(null);
  };

  const handleUploadError = (error: string) => {
    setUploadError(error);
  };

  const animateSolution = useCallback(() => {
    if (!solverRef.current) return;

    const mapDef = maps[selectedMapKey];
    // Guard against race conditions: If the map changes while solving, stop the animation.
    if (!mapDef) {
      console.error("Solver running without a valid map definition. Stopping.");
      resetState();
      return;
    }

    const next = solverRef.current.next();

    if (!next.done) {
      const { type, nodeId, mapping } = next.value;
      
      const nodeLabel = mapDef.nodes.find(n => n.id === nodeId)?.label ?? nodeId;

      setColorMapping(mapping);
      setHighlightedNode(nodeId);

      switch (type) {
        case 'TRY':
          setStatus(`Trying to color ${nodeLabel}...`);
          break;
        case 'SUCCESS':
          setStatus(`Successfully colored ${nodeLabel}.`);
          break;
        case 'BACKTRACK':
          setStatus(`Backtracking from ${nodeLabel}...`);
          break;
      }
      animationFrameId.current = requestAnimationFrame(animateSolution);
    } else {
      setIsSolving(false);
      setHighlightedNode(null);
      if (next.value) {
        setColorMapping(next.value);
        setStatus(`Solved successfully with ${numColors} colors!`);
      } else {
        setStatus(`No solution found with ${numColors} colors. Try increasing the number of colors.`);
      }
    }
  }, [numColors, selectedMapKey, maps, resetState]);

  const handleSolve = useCallback(() => {
    if (isSolving || !maps[selectedMapKey]) return;

    resetState();
    setIsSolving(true);
    setStatus('Starting solver...');
    
    const graphToSolve = buildGraph(maps[selectedMapKey]);
    solverRef.current = solveMapColoringGenerator(graphToSolve, numColors);
    
    animationFrameId.current = requestAnimationFrame(animateSolution);
  }, [isSolving, resetState, selectedMapKey, numColors, animateSolution, maps]);
  
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 lg:p-8 flex flex-col">
      <header className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-bold text-cyan-400">
          <i className="fas fa-palette mr-3"></i>AI Map Coloring
        </h1>
        <p className="text-gray-400 mt-2 text-lg">Visualizing the Graph Coloring problem with a backtracking algorithm.</p>
      </header>
      
      <main className="flex-grow flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3 xl:w-1/4 bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
          <ControlsPanel
            maps={maps}
            selectedMapKey={selectedMapKey}
            onMapChange={setSelectedMapKey}
            numColors={numColors}
            onNumColorsChange={handleNumColorsChange}
            onSolve={handleSolve}
            onReset={resetState}
            isSolving={isSolving}
            onCustomMapUpload={handleCustomMapUpload}
            onUploadError={handleUploadError}
            uploadError={uploadError}
            colorPalette={colorPalette}
            onColorPaletteChange={setColorPalette}
          />
          <hr className="my-6 border-gray-600"/>
          <InfoPanel status={status} />
        </div>
        
        <div className="lg:w-2/3 xl:w-3/4 flex-grow bg-gray-800/50 p-4 rounded-2xl shadow-lg border border-gray-700 flex items-center justify-center">
          <GraphVisualizer 
            graph={currentGraph}
            colorMapping={colorMapping}
            highlightedNode={highlightedNode}
            colorPalette={colorPalette}
          />
        </div>
      </main>
    </div>
  );
};

export default App;