import React from 'react';
import { render } from '@testing-library/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

describe('Regression: Core UI Components', () => {
    test('1️⃣ Button rendering remains stable', () => {
        const { container } = render(<Button variant="default">Click Me</Button>);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('2️⃣ Input rendering remains stable', () => {
        const { container } = render(<Input placeholder="Enter text..." />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
