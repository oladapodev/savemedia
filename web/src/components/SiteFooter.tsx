import React from 'react';

const SiteFooter: React.FC = () => {
    return (
        <footer className="bg-gray-900 text-white py-4 border-t border-gray-800">
            <div className="container mx-auto text-center">
                <p>
                    &copy; {new Date().getFullYear()} <span className="text-orange-500">iMedia</span>Save
                </p>
                <h4>Why iMediaSave?</h4>
                <p>Your one-stop solution for all media needs.</p>
            </div>
        </footer>
    );
};

export default SiteFooter;