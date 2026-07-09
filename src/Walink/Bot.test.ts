import { buildWAlinkListButton, buildWAlinkNativeFlowButtons } from './Bot'

describe('WAlink chatbot interactive builders', () => {
	test('builds reply, URL, and call buttons', () => {
		const buttons = buildWAlinkNativeFlowButtons([
			{ id: '!help', text: 'Help' },
			{ type: 'url', text: 'Website', url: 'https://example.com' },
			{ type: 'call', text: 'Call support', phoneNumber: '+263700000000' }
		])

		expect(buttons.map(button => button.name)).toEqual(['quick_reply', 'cta_url', 'cta_call'])
		expect(JSON.parse(buttons[0]!.buttonParamsJson)).toEqual({ display_text: 'Help', id: '!help' })
		expect(JSON.parse(buttons[1]!.buttonParamsJson)).toEqual({
			display_text: 'Website',
			url: 'https://example.com',
			merchant_url: 'https://example.com'
		})
		expect(JSON.parse(buttons[2]!.buttonParamsJson)).toEqual({
			display_text: 'Call support',
			phone_number: '+263700000000'
		})
	})

	test('builds a single-select list', () => {
		const button = buildWAlinkListButton({
			buttonText: 'Open menu',
			sections: [
				{
					title: 'Support',
					rows: [
						{ id: '!billing', title: 'Billing' },
						{ id: '!technical', title: 'Technical support', description: 'Connection and setup' }
					]
				}
			]
		})

		expect(button.name).toBe('single_select')
		expect(JSON.parse(button.buttonParamsJson)).toEqual({
			title: 'Open menu',
			sections: [
				{
					title: 'Support',
					rows: [
						{ id: '!billing', title: 'Billing' },
						{ id: '!technical', title: 'Technical support', description: 'Connection and setup' }
					]
				}
			]
		})
	})

	test('rejects invalid interactive messages', () => {
		expect(() => buildWAlinkNativeFlowButtons([])).toThrow('At least one button is required')
		expect(() =>
			buildWAlinkNativeFlowButtons(Array.from({ length: 11 }, (_, id) => ({ id: `${id}`, text: `${id}` })))
		).toThrow('A maximum of 10 buttons is supported')
		expect(() => buildWAlinkListButton({ sections: [] })).toThrow('At least one list row is required')
	})
})
