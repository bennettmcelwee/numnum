import React from 'react';

export default ({ messages }) => (
    <div className="messager">
        {messages && messages.length ?
            <>
                <h2>Progress</h2>
                { messages.map((message, i) => <div key={i}>{message}</div>) }
            </>
            :
            null
        }
    </div>
);
