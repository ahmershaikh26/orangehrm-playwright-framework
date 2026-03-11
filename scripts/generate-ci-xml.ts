import { writeFileSync } from 'fs';
import { join } from 'path';

const generateCIConfigXML = () => {
    const xmlContent = `
<testsuites>
    <testsuite name="Playwright Tests" tests="0" failures="0" errors="0">
        <testcase classname="SampleTest" name="SampleTestCase" time="0"/>
    </testsuite>
</testsuites>
    `.trim();

    const filePath = join(__dirname, '../ci/runner/runner.xml');
    writeFileSync(filePath, xmlContent);
    console.log(`CI XML configuration generated at: ${filePath}`);
};

generateCIConfigXML();