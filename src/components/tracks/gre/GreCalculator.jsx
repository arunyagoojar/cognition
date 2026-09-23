import React, { useState, useRef, useEffect } from 'react';
import { X, Minus, Move } from 'lucide-react';

export default function GreCalculator({ isOpen, onClose, onTransferDisplay }) {
  const [display, setDisplay] = useState('0');
  const [memory, setMemory] = useState(0);
  const [hasMemory, setHasMemory] = useState(false);
  const [operator, setOperator] = useState(null);
  const [operand, setOperand] = useState(null);
  const [waitingForNext, setWaitingForNext] = useState(false);

  // Dragging support
  const [pos, setPos] = useState({ x: 40, y: 80 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      setPos({
        x: Math.max(10, Math.min(window.innerWidth - 300, e.clientX - dragStart.current.x)),
        y: Math.max(10, Math.min(window.innerHeight - 380, e.clientY - dragStart.current.y))
      });
    };
    const handleMouseUp = () => {
      isDragging.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!isOpen) return null;

  // Number key
  const handleDigit = (digit) => {
    if (waitingForNext) {
      setDisplay(String(digit));
      setWaitingForNext(false);
    } else {
      setDisplay(display === '0' ? String(digit) : display + digit);
    }
  };

  // Decimal
  const handleDecimal = () => {
    if (waitingForNext) {
      setDisplay('0.');
      setWaitingForNext(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  // Operations: +, -, *, /
  const handleOperator = (nextOp) => {
    const inputValue = parseFloat(display);
    if (operand === null) {
      setOperand(inputValue);
    } else if (operator) {
      const current = operand || 0;
      let result = current;
      if (operator === '+') result = current + inputValue;
      else if (operator === '-') result = current - inputValue;
      else if (operator === '×') result = current * inputValue;
      else if (operator === '÷') result = inputValue !== 0 ? current / inputValue : 'Error';

      setOperand(result === 'Error' ? null : result);
      setDisplay(String(result));
    }
    setWaitingForNext(true);
    setOperator(nextOp);
  };

  // Equal
  const handleEquals = () => {
    const inputValue = parseFloat(display);
    if (operator && operand !== null) {
      let result = operand;
      if (operator === '+') result = operand + inputValue;
      else if (operator === '-') result = operand - inputValue;
      else if (operator === '×') result = operand * inputValue;
      else if (operator === '÷') result = inputValue !== 0 ? operand / inputValue : 'Error';

      setDisplay(String(result));
      setOperand(null);
      setOperator(null);
      setWaitingForNext(true);
    }
  };

  // Clear All
  const handleClear = () => {
    setDisplay('0');
    setOperand(null);
    setOperator(null);
    setWaitingForNext(false);
  };

  // Clear Entry
  const handleClearEntry = () => {
    setDisplay('0');
  };

  // Sign toggle
  const handleSignToggle = () => {
    const val = parseFloat(display);
    if (val !== 0) {
      setDisplay(String(-val));
    }
  };

  // Square Root
  const handleSqrt = () => {
    const val = parseFloat(display);
    if (val < 0) {
      setDisplay('Error');
    } else {
      setDisplay(String(Math.sqrt(val)));
      setWaitingForNext(true);
    }
  };

  // Memory keys
  const handleMemoryRecall = () => {
    setDisplay(String(memory));
    setWaitingForNext(true);
  };

  const handleMemoryClear = () => {
    setMemory(0);
    setHasMemory(false);
  };

  const handleMemoryAdd = () => {
    const val = parseFloat(display);
    if (!isNaN(val)) {
      setMemory(prev => prev + val);
      setHasMemory(true);
      setWaitingForNext(true);
    }
  };

  const handleMemorySub = () => {
    const val = parseFloat(display);
    if (!isNaN(val)) {
      setMemory(prev => prev - val);
      setHasMemory(true);
      setWaitingForNext(true);
    }
  };

  const handleTransfer = () => {
    if (onTransferDisplay) {
      onTransferDisplay(display);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: 254,
        background: '#242424',
        border: '2px solid #529cca',
        borderRadius: 8,
        boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
        zIndex: 9999,
        userSelect: 'none',
        fontFamily: 'monospace, sans-serif'
      }}
    >
      {/* Title Bar / Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          background: 'linear-gradient(180deg, #383838, #2c2c2c)',
          padding: '6px 10px',
          borderBottom: '1px solid #444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'move',
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img
            src="/images/mr_crabs_frame1_idle.png"
            alt="Mr. Krabs"
            style={{ width: 18, height: 18, objectFit: 'contain' }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#f0f0f0', letterSpacing: 0.5 }}>
            ETS Calculator
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#aaa',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Calculator Body */}
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Display Screen */}
        <div style={{
          background: '#dbe7c9',
          border: '2px inset #999',
          borderRadius: 4,
          padding: '6px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#1a2410',
          fontFamily: 'var(--font-mono, monospace)',
          minHeight: 38
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#4a602a' }}>
            {hasMemory ? 'M' : ''}
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {display}
          </span>
        </div>

        {/* Transfer Button */}
        {onTransferDisplay && (
          <button
            onClick={handleTransfer}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              background: '#3a506b',
              color: '#ffffff',
              border: '1px solid #529cca',
              borderRadius: 4,
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            Transfer Display ➔
          </button>
        )}

        {/* Keypad Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 4
        }}>
          {/* Memory Row */}
          <CalcBtn label="MR" onClick={handleMemoryRecall} isSpecial />
          <CalcBtn label="MC" onClick={handleMemoryClear} isSpecial />
          <CalcBtn label="M+" onClick={handleMemoryAdd} isSpecial />
          <CalcBtn label="M−" onClick={handleMemorySub} isSpecial />
          <CalcBtn label="C" onClick={handleClear} isSpecial color="#e03e3e" />

          {/* Row 2 */}
          <CalcBtn label="7" onClick={() => handleDigit(7)} />
          <CalcBtn label="8" onClick={() => handleDigit(8)} />
          <CalcBtn label="9" onClick={() => handleDigit(9)} />
          <CalcBtn label="÷" onClick={() => handleOperator('÷')} isOperator />
          <CalcBtn label="CE" onClick={handleClearEntry} isSpecial />

          {/* Row 3 */}
          <CalcBtn label="4" onClick={() => handleDigit(4)} />
          <CalcBtn label="5" onClick={() => handleDigit(5)} />
          <CalcBtn label="6" onClick={() => handleDigit(6)} />
          <CalcBtn label="×" onClick={() => handleOperator('×')} isOperator />
          <CalcBtn label="√" onClick={handleSqrt} isOperator />

          {/* Row 4 */}
          <CalcBtn label="1" onClick={() => handleDigit(1)} />
          <CalcBtn label="2" onClick={() => handleDigit(2)} />
          <CalcBtn label="3" onClick={() => handleDigit(3)} />
          <CalcBtn label="−" onClick={() => handleOperator('-')} isOperator />
          <CalcBtn label="±" onClick={handleSignToggle} isSpecial />

          {/* Row 5 */}
          <CalcBtn label="0" onClick={() => handleDigit(0)} style={{ gridColumn: 'span 2' }} />
          <CalcBtn label="." onClick={handleDecimal} />
          <CalcBtn label="+" onClick={() => handleOperator('+')} isOperator />
          <CalcBtn label="=" onClick={handleEquals} isOperator style={{ background: '#529cca', color: '#fff' }} />
        </div>
      </div>
    </div>
  );
}

function CalcBtn({ label, onClick, isOperator, isSpecial, color, style = {} }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 4px',
        fontSize: 12.5,
        fontWeight: isOperator || isSpecial ? 700 : 500,
        background: isOperator ? '#3c4043' : isSpecial ? '#2d3135' : '#45494e',
        color: color || (isOperator ? '#8ab4f8' : '#e8eaed'),
        border: '1px solid #5f6368',
        borderRadius: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      {label}
    </button>
  );
}
